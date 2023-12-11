//! Universally known environment variables.

use crate::env::accessor::PathLike;



/// PATH environment variable.
///
/// It is a special variable that contains a list of paths, that define the search path for
/// executable files.
pub const PATH: PathLike = PathLike("PATH");

/// Windows-specific environment variables.
pub mod win {
    use crate::define_env_var;
    define_env_var! {
        /// Per-user custom settings and other information needed by applications.
        ///
        /// Example: `C:\Users\{username}\AppData\Roaming`
        APPDATA, PathBuf;

        /// Per-user custom settings and other information needed by applications that do not apply
        /// when the user roams.
        LOCALAPPDATA, PathBuf;

        /// The user's home directory.
        USERPROFILE, PathBuf;
    }
}

define_env_var! {
    /// Variable in Unix-like systems that overrides individual `LC_*` settings for locale-specific
    /// program behavior, such as time formatting (`LC_TIME`), string sorting (`LC_COLLATE`), and
    /// currency formatting (`LC_MONETARY`). Setting `LC_ALL` ensures uniform application of locale
    /// settings, commonly utilized in scripting and debugging to maintain consistency irrespective
    /// of user-specific configurations.
    LC_ALL, String;
}

/// The `C.UTF-8` locale, when used as a value for [`LC_ALL`] or other `LC_*` environment variables
/// in Unix-like systems, combines the minimalistic behavior of the default C locale with UTF-8
/// character encoding.
pub const C_UTF8: &str = "C.UTF-8";
