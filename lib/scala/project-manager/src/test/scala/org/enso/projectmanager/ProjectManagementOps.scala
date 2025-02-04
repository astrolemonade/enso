package org.enso.projectmanager

import akka.testkit.TestDuration
import io.circe.Json
import io.circe.syntax._
import io.circe.literal._
import org.enso.semver.SemVerJson._
import io.circe.parser.parse
import org.enso.projectmanager.data.Socket
import org.enso.projectmanager.data.MissingComponentActions.MissingComponentAction
import org.enso.projectmanager.protocol.ProjectManagementApi.ProjectOpen
import org.enso.semver.SemVer
import org.scalactic.source.Position

import java.io.File
import java.util.UUID

import scala.concurrent.duration._

trait ProjectManagementOps { this: BaseServerSpec =>

  def createProject(
    name: String,
    nameSuffix: Option[Int]                                = None,
    projectTemplate: Option[String]                        = None,
    missingComponentAction: Option[MissingComponentAction] = None,
    projectsDirectory: Option[File]                        = None
  )(implicit client: WsTestClient, pos: Position): UUID = {
    val fields = Seq("name" -> name.asJson) ++
      missingComponentAction
        .map(a => "missingComponentAction" -> a.asJson)
        .toSeq ++
      projectTemplate
        .map(t => "projectTemplate" -> t.asJson)
        .toSeq ++
      projectsDirectory
        .map(d => "projectsDirectory" -> d.toString.asJson)
        .toSeq

    val params  = Json.obj(fields: _*)
    val request = json"""
            { "jsonrpc": "2.0",
              "method": "project/create",
              "id": 0,
              "params": $params
            }
          """
    client.send(request)
    val projectId   = getGeneratedUUID
    val projectName = nameSuffix.fold(name)(n => s"${name}_$n")
    client.fuzzyExpectJson(
      json"""
          {
            "jsonrpc":"2.0",
            "id":0,
            "result": {
              "projectId": $projectId,
              "projectName": $projectName,
              "projectNormalizedName": "*"
            }
          }
          """,
      timeout = 10.seconds.dilated
    )
    projectId
  }

  def openProject(
    projectId: UUID,
    projectsDirectory: Option[File] = None
  )(implicit client: WsTestClient, pos: Position): Socket = {
    val fields = Seq("projectId" -> projectId.asJson) ++
      projectsDirectory
        .map(d => "projectsDirectory" -> d.toString.asJson)
        .toSeq
    val params = Json.obj(fields: _*)
    client.send(json"""
            { "jsonrpc": "2.0",
              "method": "project/open",
              "id": 0,
              "params": $params
            }
          """)
    val Right(openReply) = parse(client.expectMessage(20.seconds.dilated))
    val socket = for {
      result <- openReply.hcursor.downExpectedField("result")
      addr   <- result.downExpectedField("languageServerJsonAddress")
      host   <- addr.downField("host").as[String]
      port   <- addr.downField("port").as[Int]
    } yield Socket(host, port)

    socket.fold(fail(s"Failed to decode json: $openReply", _), identity)
  }

  def openProjectData(implicit
    client: WsTestClient,
    pos: Position
  ): ProjectOpen.Result = {
    val Right(openReply) = parse(client.expectMessage(20.seconds.dilated))
    val openResult = for {
      result         <- openReply.hcursor.downExpectedField("result")
      engineVer      <- result.downField("engineVersion").as[SemVer]
      jsonAddr       <- result.downExpectedField("languageServerJsonAddress")
      jsonHost       <- jsonAddr.downField("host").as[String]
      jsonPort       <- jsonAddr.downField("port").as[Int]
      binAddr        <- result.downExpectedField("languageServerBinaryAddress")
      binHost        <- binAddr.downField("host").as[String]
      binPort        <- binAddr.downField("port").as[Int]
      projectName    <- result.downField("projectName").as[String]
      normalizedName <- result.downField("projectNormalizedName").as[String]
      namespace      <- result.downField("projectNamespace").as[String]
    } yield {
      val jsonSock = Socket(jsonHost, jsonPort)
      val binSock  = Socket(binHost, binPort)
      ProjectOpen.Result(
        engineVer,
        jsonSock,
        None,
        binSock,
        None,
        projectName,
        normalizedName,
        namespace
      )
    }
    openResult.getOrElse(fail("Should have worked."))
  }

  def closeProject(
    projectId: UUID
  )(implicit client: WsTestClient, pos: Position): Unit = {
    client.send(json"""
            { "jsonrpc": "2.0",
              "method": "project/close",
              "id": 0,
              "params": {
                "projectId": $projectId
              }
            }
          """)
    client.expectJson(
      json"""
          {
            "jsonrpc":"2.0",
            "id":0,
            "result": null
          }
          """,
      20.seconds.dilated
    )
  }

  def deleteProject(
    projectId: UUID,
    projectsDirectory: Option[File] = None
  )(implicit client: WsTestClient, pos: Position): Unit = {
    val fields = Seq("projectId" -> projectId.asJson) ++
      projectsDirectory
        .map(d => "projectsDirectory" -> d.toString.asJson)
        .toSeq
    val params = Json.obj(fields: _*)

    client.send(json"""
            { "jsonrpc": "2.0",
              "method": "project/delete",
              "id": 0,
              "params": $params
            }
          """)
    client.expectJson(json"""
          {
            "jsonrpc":"2.0",
            "id":0,
            "result": null
          }
          """)
  }

}
