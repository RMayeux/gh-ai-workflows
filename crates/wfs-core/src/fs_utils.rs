/// ponytail: simple file reader matching files by regex pattern.
/// Matches filenames (not full paths) against the pattern.
/// Only reads regular files, ignores directories.
pub fn read_matching_files(pattern: &str) -> String {
    let re = match regex::Regex::new(pattern) {
        Ok(r) => r,
        Err(_) => return String::new(),
    };
    let read_dir = match std::fs::read_dir(".") {
        Ok(d) => d,
        Err(_) => return String::new(),
    };
    let mut result = String::new();
    for entry in read_dir.flatten() {
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
            if re.is_match(name) {
                if let Ok(content) = std::fs::read_to_string(&path) {
                    result.push_str(&format!("\n--- {} ---\n{content}\n", name));
                }
            }
        }
    }
    result
}
