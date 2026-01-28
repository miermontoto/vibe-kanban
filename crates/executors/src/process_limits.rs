//! limites de recursos para procesos hijo
//!
//! este módulo proporciona funcionalidad para limitar el uso de CPU de los procesos
//! spawneados durante la ejecución de tareas. esto previene que procesos de compilación
//! como rustc y cc1 consuman todos los cores disponibles.

use std::collections::HashMap;

use tokio::process::Command;

/// número máximo de jobs paralelos para compilación nativa.
/// usar la mitad de los cores disponibles, con un mínimo de 1.
fn default_parallel_jobs() -> usize {
    let cores = std::thread::available_parallelism()
        .map(|p| p.get())
        .unwrap_or(1);
    std::cmp::max(1, cores / 2)
}

/// valor nice para procesos de ejecución.
/// 10 es un valor moderado que reduce la prioridad sin afectar demasiado el rendimiento.
const DEFAULT_NICE_VALUE: i32 = 10;

/// configura las variables de entorno para limitar la compilación paralela.
/// esto afecta a:
/// - NPM_CONFIG_JOBS: limita npm install/build parallelism
/// - MAKEFLAGS: limita make parallelism (afecta cc1)
/// - CARGO_BUILD_JOBS: limita cargo build parallelism (afecta rustc)
/// - CMAKE_BUILD_PARALLEL_LEVEL: limita cmake parallelism
pub fn get_compilation_limit_env_vars() -> HashMap<String, String> {
    let jobs = default_parallel_jobs().to_string();
    let mut vars = HashMap::new();

    // npm: limita operaciones paralelas durante install
    vars.insert("NPM_CONFIG_JOBS".to_string(), jobs.clone());

    // make: limita jobs paralelos (-j flag implícito)
    vars.insert("MAKEFLAGS".to_string(), format!("-j{jobs}"));

    // cargo: limita compilación paralela de crates
    vars.insert("CARGO_BUILD_JOBS".to_string(), jobs.clone());

    // cmake: limita build paralelo
    vars.insert("CMAKE_BUILD_PARALLEL_LEVEL".to_string(), jobs);

    vars
}

/// aplica límites de prioridad al comando antes de spawn.
/// en unix, esto usa nice para reducir la prioridad del proceso.
/// en windows, esto es un no-op por ahora.
#[cfg(unix)]
pub fn apply_process_priority(command: &mut Command) {
    #[allow(unused_imports)] // CommandExt es usado implícitamente por pre_exec
    use std::os::unix::process::CommandExt;

    let nice_value = DEFAULT_NICE_VALUE;

    // SAFETY: nice() es async-signal-safe según POSIX
    // pre_exec se ejecuta después de fork() pero antes de exec()
    unsafe {
        command.pre_exec(move || {
            // incrementar el nice value (reducir prioridad)
            // nice() retorna el nuevo nice value o -1 en error
            // errno debe ser reseteado antes de la llamada para detectar errores
            *libc::__errno_location() = 0;
            let result = libc::nice(nice_value);
            if result == -1 && *libc::__errno_location() != 0 {
                // en caso de error, continuamos de todos modos
                // no queremos fallar el spawn por un error de nice
                eprintln!(
                    "warning: failed to set nice value: {}",
                    std::io::Error::last_os_error()
                );
            }
            Ok(())
        });
    }
}

#[cfg(windows)]
pub fn apply_process_priority(_command: &mut Command) {
    // en windows, se podría usar SetPriorityClass pero requiere
    // acceso al handle del proceso después del spawn, lo cual
    // no es compatible con pre_exec. por ahora es un no-op.
    // TODO: implementar usando job objects en windows
}

/// aplica todas las limitaciones de recursos a un comando.
/// esto incluye:
/// - variables de entorno para limitar compilación paralela
/// - prioridad de proceso reducida (nice) en unix
pub fn apply_all_limits(command: &mut Command) {
    // aplicar variables de entorno
    for (key, value) in get_compilation_limit_env_vars() {
        command.env(key, value);
    }

    // aplicar prioridad de proceso
    apply_process_priority(command);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_parallel_jobs() {
        let jobs = default_parallel_jobs();
        assert!(jobs >= 1, "jobs should be at least 1");

        let cores = std::thread::available_parallelism()
            .map(|p| p.get())
            .unwrap_or(1);
        assert!(jobs <= cores, "jobs should not exceed available cores");
    }

    #[test]
    fn test_compilation_limit_env_vars() {
        let vars = get_compilation_limit_env_vars();

        assert!(vars.contains_key("NPM_CONFIG_JOBS"));
        assert!(vars.contains_key("MAKEFLAGS"));
        assert!(vars.contains_key("CARGO_BUILD_JOBS"));
        assert!(vars.contains_key("CMAKE_BUILD_PARALLEL_LEVEL"));

        // verificar que MAKEFLAGS tiene el formato correcto
        let makeflags = vars.get("MAKEFLAGS").unwrap();
        assert!(
            makeflags.starts_with("-j"),
            "MAKEFLAGS should start with -j"
        );
    }
}
