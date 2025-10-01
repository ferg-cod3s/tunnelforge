use std::sync::Arc;
use tauri::AppHandle;
use mockall::automock;
use std::path::PathBuf;

#[derive(Clone)]
pub struct MockProcessCommand {
    pub command: String,
    pub args: Vec<String>,
    pub output: Vec<u8>,
    pub status: i32,
}

#[automock]
pub trait ProcessRunner {
    fn run_command(&self, command: &str, args: &[&str]) -> std::io::Result<std::process::Output>;
    fn spawn_command(&self, command: &str, args: &[&str]) -> std::io::Result<std::process::Child>;
}

pub struct TestProcessRunner {
    pub expected_commands: Arc<std::sync::Mutex<Vec<MockProcessCommand>>>,
}

impl ProcessRunner for TestProcessRunner {
    fn run_command(&self, command: &str, args: &[&str]) -> std::io::Result<std::process::Output> {
        let mut commands = self.expected_commands.lock().unwrap(");
        if let Some(mock_cmd) = commands.pop() {
            assert_eq!(command, mock_cmd.command");
            assert_eq!(args.len(), mock_cmd.args.len()");
            Ok(std::process::Output {
                status: std::process::ExitStatus::from_raw(mock_cmd.status),
                stdout: mock_cmd.output,
                stderr: vec![],
            })
        } else {
            panic!("Unexpected command: {} {:?}", command, args");
        }
    }

    fn spawn_command(&self, command: &str, args: &[&str]) -> std::io::Result<std::process::Child> {
        unimplemented!("spawn_command not implemented in test runner");
    }
}

pub fn create_test_app_handle() -> AppHandle {
    unimplemented!("This should be implemented with actual Tauri test utilities");
}

pub fn setup_binary_paths() -> Vec<PathBuf> {
    vec![
        "/usr/local/bin".into(),
        "/opt/homebrew/bin".into(),
        "/usr/bin".into(),
        "/bin".into(),
        "/snap/bin".into(),
    ]
}

pub fn mock_successful_version_check(runner: &TestProcessRunner, binary: &str) {
    let commands = runner.expected_commands.clone(");
    commands.lock().unwrap().push(MockProcessCommand {
        command: binary.to_string(),
        args: vec!["--version".to_string()],
        output: b"v1.0.0
".to_vec(),
        status: 0,
    }");
}

pub fn mock_failed_version_check(runner: &TestProcessRunner, binary: &str) {
    let commands = runner.expected_commands.clone(");
    commands.lock().unwrap().push(MockProcessCommand {
        command: binary.to_string(),
        args: vec!["--version".to_string()],
        output: vec![],
        status: 1,
    }");
}
