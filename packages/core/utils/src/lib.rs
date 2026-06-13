use thiserror::Error;

#[derive(Debug, Error)]
pub enum UtilError {
    #[error("Invalid input: {0}")]
    InvalidInput(String),
    #[error("Parse error: {0}")]
    ParseError(String),
}

pub fn generate_id() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let duration = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default();
    format!("{:x}-{:x}", duration.as_secs(), duration.subsec_nanos())
}

pub fn clamp(value: f32, min: f32, max: f32) -> f32 {
    value.max(min).min(max)
}

pub fn lerp(a: f32, b: f32, t: f32) -> f32 {
    a + (b - a) * t
}

pub fn angle_to_vector(angle: f32) -> (f32, f32) {
    (angle.cos(), angle.sin())
}

pub fn vector_to_angle(x: f32, y: f32) -> f32 {
    y.atan2(x)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_clamp() {
        assert_eq!(clamp(5.0, 0.0, 10.0), 5.0);
        assert_eq!(clamp(-5.0, 0.0, 10.0), 0.0);
        assert_eq!(clamp(15.0, 0.0, 10.0), 10.0);
    }

    #[test]
    fn test_lerp() {
        assert!((lerp(0.0, 10.0, 0.5) - 5.0).abs() < 0.001);
    }

    #[test]
    fn test_angle_vector_conversion() {
        let angle = std::f32::consts::PI / 2.0;
        let (x, y) = angle_to_vector(angle);
        assert!((x - 0.0).abs() < 0.001);
        assert!((y - 1.0).abs() < 0.001);
    }
}
