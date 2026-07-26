use std::collections::HashMap;

#[derive(Debug, Clone)]
pub struct PromptDefinition {
    pub id: String,
    pub system: String,
    pub user: String,
    pub overrides: HashMap<String, PromptOverride>,
}

#[derive(Debug, Clone)]
pub struct PromptOverride {
    pub system: Option<String>,
    pub user: Option<String>,
}

#[derive(Debug, Clone)]
pub struct PromptResult {
    pub system: String,
    pub user: String,
}

pub struct PromptEngine;

impl PromptEngine {
    pub fn render(definition: &PromptDefinition, variables: &HashMap<String, String>) -> PromptResult {
        let system = Self::interpolate(&definition.system, variables);
        let user = Self::interpolate(&definition.user, variables);
        PromptResult { system, user }
    }

    fn interpolate(template: &str, variables: &HashMap<String, String>) -> String {
        let result = Self::resolve_section_blocks(template, variables);
        Self::resolve_vars(&result, variables)
    }

    fn is_truthy(val: Option<&String>) -> bool {
        val.map_or(false, |v| !v.is_empty() && v != "false" && v != "0")
    }

    fn resolve_section_blocks(template: &str, variables: &HashMap<String, String>) -> String {
        let mut result = template.to_string();

        // Resolve truthy blocks {{#key}}...{{/key}}
        while let Some(start) = result.find("{{#") {
            let rest = &result[start + 3..];
            let key_end = rest.find("}}").unwrap_or(rest.len());
            let key: String = rest[..key_end].chars().take_while(|c| c.is_alphanumeric()).collect();
            let inner_start = start + 3 + key.len() + 2; // past {{#key}}
            let close_tag = format!("{{{{/{key}}}}}");
            if let Some(inner_end) = result[inner_start..].find(&close_tag) {
                let inner = &result[inner_start..inner_start + inner_end];
                let replacement = if Self::is_truthy(variables.get(&key)) {
                    Self::resolve_section_blocks(inner, variables)
                } else {
                    String::new()
                };
                let full_tag_start = start;
                let full_tag_end = inner_start + inner_end + close_tag.len();
                let before = &result[..full_tag_start];
                let after = &result[full_tag_end..];
                result = format!("{before}{replacement}{after}");
            } else {
                break;
            }
        }

        // Resolve falsy blocks {{^key}}...{{/key}}
        while let Some(start) = result.find("{{^") {
            let rest = &result[start + 3..];
            let key_end = rest.find("}}").unwrap_or(rest.len());
            let key: String = rest[..key_end].chars().take_while(|c| c.is_alphanumeric()).collect();
            let inner_start = start + 3 + key.len() + 2;
            let close_tag = format!("{{{{/{key}}}}}");
            if let Some(inner_end) = result[inner_start..].find(&close_tag) {
                let inner = &result[inner_start..inner_start + inner_end];
                let replacement = if Self::is_truthy(variables.get(&key)) {
                    String::new()
                } else {
                    Self::resolve_section_blocks(inner, variables)
                };
                let full_tag_start = start;
                let full_tag_end = inner_start + inner_end + close_tag.len();
                let before = &result[..full_tag_start];
                let after = &result[full_tag_end..];
                result = format!("{before}{replacement}{after}");
            } else {
                break;
            }
        }

        result
    }

    fn resolve_vars(template: &str, variables: &HashMap<String, String>) -> String {
        let mut result = String::new();
        let mut i = 0;
        let bytes = template.as_bytes();
        while i < bytes.len() {
            if i + 1 < bytes.len() && bytes[i] == b'{' && bytes[i + 1] == b'{' {
                let rest = &template[i + 2..];
                if let Some(end) = rest.find("}}") {
                    let var_name: String = rest[..end].chars().take_while(|c| c.is_alphanumeric()).collect();
                    let val = variables.get(&var_name).cloned().unwrap_or_default();
                    result.push_str(&val);
                    i += 2 + var_name.len() + 2;
                } else {
                    result.push(bytes[i] as char);
                    i += 1;
                }
            } else {
                result.push(bytes[i] as char);
                i += 1;
            }
        }
        result
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_simple_variable() {
        let vars = HashMap::from([("name".to_string(), "world".to_string())]);
        let result = PromptEngine::interpolate("Hello {{name}}!", &vars);
        assert_eq!(result, "Hello world!");
    }

    #[test]
    fn test_truthy_block() {
        let vars = HashMap::from([("show".to_string(), "true".to_string())]);
        let result = PromptEngine::interpolate("{{#show}}visible{{/show}}", &vars);
        assert_eq!(result, "visible");
    }

    #[test]
    fn test_falsy_block() {
        let vars = HashMap::from([("show".to_string(), String::new())]);
        let result = PromptEngine::interpolate("{{#show}}visible{{/show}}", &vars);
        assert_eq!(result, "");
    }

    #[test]
    fn test_inverse_block() {
        let vars = HashMap::new();
        let result = PromptEngine::interpolate("{{^hidden}}fallback{{/hidden}}", &vars);
        assert_eq!(result, "fallback");
    }

    #[test]
    fn test_nested_blocks() {
        let vars = HashMap::from([
            ("outer".to_string(), "true".to_string()),
            ("inner".to_string(), "true".to_string()),
        ]);
        let result = PromptEngine::interpolate("{{#outer}}a{{#inner}}b{{/inner}}c{{/outer}}", &vars);
        assert_eq!(result, "abc");
    }

    #[test]
    fn test_missing_var_empty() {
        let vars = HashMap::new();
        let result = PromptEngine::interpolate("Hello {{unknown}}!", &vars);
        assert_eq!(result, "Hello !");
    }
}
