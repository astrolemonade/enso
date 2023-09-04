package org.enso.languageserver.libraries

import akka.actor.Props
import com.typesafe.scalalogging.LazyLogging
import org.enso.distribution.FileSystem
import org.enso.editions.{Editions, LibraryName}
import org.enso.languageserver.libraries.LocalLibraryManagerProtocol._
import org.enso.librarymanager.LibraryLocations
import org.enso.librarymanager.local.DefaultLocalLibraryProvider
import org.enso.librarymanager.published.repository.LibraryManifest
import org.enso.pkg.validation.NameValidation
import org.enso.pkg.{Config, Contact, Package, PackageManager}
import org.enso.yaml.YamlHelper

import java.io.File
import java.nio.file.{Files, Path}
import scala.util.{Success, Try}

/** An Actor that manages local libraries. */
class LocalLibraryManager(
  currentProjectRoot: File,
  libraryLocations: LibraryLocations
) extends BlockingSynchronizedRequestHandler
    with LazyLogging {
  val localLibraryProvider = new DefaultLocalLibraryProvider(
    libraryLocations.localLibrarySearchPaths
  )

  override def requestStage: Receive = { case request: Request =>
    request match {
      case GetMetadata(libraryName) =>
        startRequest(getMetadata(libraryName))
      case request: SetMetadata =>
        startRequest(
          setMetadata(
            request.libraryName,
            description = request.description,
            tagLine     = request.tagLine
          )
        )
      case GetPackage(libraryName) =>
        startRequest(getPackage(libraryName))
      case ListLocalLibraries =>
        startRequest(listLocalLibraries())
      case Create(libraryName, authors, maintainers, license) =>
        startRequest(createLibrary(libraryName, authors, maintainers, license))
      case FindLibrary(libraryName) =>
        startRequest(findLibrary(libraryName))
    }
  }

  /** Checks if the library name is a valid Enso module name. */
  private def validateLibraryName(libraryName: LibraryName): Unit = {
    // TODO [RW] more specific exceptions
    NameValidation.validateName(libraryName.name) match {
      case Left(error) =>
        throw new RuntimeException(s"Library name is not valid: [$error].")
      case Right(_) =>
    }
  }

  /** Creates a new local library project.
    *
    * The project is created in the first directory of the local library search
    * path that is writable.
    */
  private def createLibrary(
    libraryName: LibraryName,
    authors: Seq[Contact],
    maintainers: Seq[Contact],
    license: String
  ): Try[EmptyResponse] = Try {
    validateLibraryName(libraryName)

    // TODO [RW] make the exceptions more relevant
    val possibleRoots = LazyList
      .from(libraryLocations.localLibrarySearchPaths)
      .filter { path =>
        Try { if (Files.notExists(path)) Files.createDirectories(path) }
        Files.isWritable(path)
      }
    val librariesRoot = possibleRoots.headOption.getOrElse {
      throw new RuntimeException(
        "Cannot find a writable directory on local library path."
      )
    }

    val libraryPath = librariesRoot.resolve(libraryName.name)
    if (Files.exists(libraryPath)) {
      // TODO [RW] we could try finding alternative names (as directory name does not matter for local libraries), to find a free name
      // This can be done as part of #1877
      throw new RuntimeException("Local library already exists")
    }

    PackageManager.Default.create(
      libraryPath.toFile,
      name        = libraryName.name,
      namespace   = libraryName.namespace,
      edition     = findCurrentProjectEdition(),
      authors     = authors.toList,
      maintainers = maintainers.toList,
      license     = license
    )

    EmptyResponse()
  }

  /** Lists all local libraries. */
  private def listLocalLibraries(): Try[ListLocalLibrariesResponse] = for {
    libraryNames <- findLocalLibraries()
    libraryEntries = libraryNames.distinct.map { name =>
      LibraryEntry(
        name.namespace,
        name.name,
        LibraryEntry.LocalLibraryVersion,
        isCached = true
      )
    }
  } yield ListLocalLibrariesResponse(libraryEntries)

  private def findLocalLibraries(): Try[Seq[LibraryName]] = Try {
    localLibraryProvider.findAvailableLocalLibraries()
  }

  /** Finds the path on the filesystem to a local library. */
  private def findLibrary(
    libraryName: LibraryName
  ): Try[FindLibraryResponse] = Try {
    val pathOpt = localLibraryProvider.findLibrary(libraryName)
    FindLibraryResponse(pathOpt)
  }

  /** Loads the metadata for a local library.
    *
    * If the manifest does not exist, an empty but successful response is sent.
    */
  private def getMetadata(libraryName: LibraryName): Try[GetMetadataResponse] =
    for {
      libraryRootPath <- localLibraryProvider
        .findLibrary(libraryName)
        .toRight(LocalLibraryNotFoundError(libraryName))
        .toTry
      manifestPath = libraryRootPath / LibraryManifest.filename
      manifest <- loadManifest(manifestPath)
    } yield GetMetadataResponse(
      description = manifest.description,
      tagLine     = manifest.tagLine
    )

  /** Sets the metadata.
    *
    * The manifest file is created if it did not exist.
    */
  private def setMetadata(
    libraryName: LibraryName,
    description: Option[String],
    tagLine: Option[String]
  ): Try[EmptyResponse] = for {
    libraryRootPath <- localLibraryProvider
      .findLibrary(libraryName)
      .toRight(LocalLibraryNotFoundError(libraryName))
      .toTry
    manifestPath = libraryRootPath / LibraryManifest.filename
    manifest <- loadManifest(manifestPath).recover { error =>
      logger.error(
        "Failed to load the manifest for local library [{}].",
        libraryName,
        error
      )
      logger.warn(
        "Falling back to an empty manifest for [{}] due to loading errors.",
        libraryName
      )

      LibraryManifest.empty
    }
    updatedManifest = manifest.copy(
      description = description,
      tagLine     = tagLine
    )
    _ = saveManifest(manifestPath, updatedManifest)
  } yield EmptyResponse()

  /** Loads the package config for a local library. */
  private def getPackage(libraryName: LibraryName): Try[GetPackageResponse] =
    for {
      libraryRootPath <- localLibraryProvider
        .findLibrary(libraryName)
        .toRight(LocalLibraryNotFoundError(libraryName))
        .toTry
      configPath = libraryRootPath / Package.configFileName
      config <- loadPackageConfig(configPath)
    } yield {
      config.componentGroups match {
        case Left(error) =>
          logger.error(
            "Failed to parse library [{}] component groups.",
            libraryName,
            error
          )
        case _ =>
      }
      GetPackageResponse(
        libraryName     = LibraryName(config.namespace, config.moduleName),
        license         = config.license,
        componentGroups = config.componentGroups.toOption,
        rawPackage      = config.originalJson
      )
    }

  /** Tries to load the manifest.
    *
    * If the file does not exist, an empty manifest is returned. Any other
    * issues related to loading the file are treated as errors.
    */
  private def loadManifest(manifestPath: Path): Try[LibraryManifest] =
    if (Files.exists(manifestPath))
      YamlHelper.load[LibraryManifest](manifestPath)
    else Success(LibraryManifest.empty)

  /** Saves the manifest file. */
  private def saveManifest(
    manifestPath: Path,
    manifest: LibraryManifest
  ): Unit = FileSystem.writeTextFile(manifestPath, YamlHelper.toYaml(manifest))

  /** Load the package config. */
  private def loadPackageConfig(packagePath: Path): Try[Config] =
    YamlHelper.load[Config](packagePath)

  /** Finds the edition associated with the current project, if specified in its
    * config.
    */
  private def findCurrentProjectEdition(): Option[Editions.RawEdition] = {
    val pkg = PackageManager.Default.loadPackage(currentProjectRoot).get
    pkg.getConfig().edition
  }
}

object LocalLibraryManager {
  def props(
    currentProjectRoot: File,
    libraryLocations: LibraryLocations
  ): Props = Props(
    new LocalLibraryManager(currentProjectRoot, libraryLocations)
  )
}
