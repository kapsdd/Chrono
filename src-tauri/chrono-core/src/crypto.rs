//! Password hashing for lobby join codes.
//!
//! Mirrors the previous Web Crypto implementation byte-for-byte: plain
//! SHA-256 over the UTF-8 password bytes, lowercase hex. Kept identical so
//! existing published join codes keep validating.

use sha2::{Digest, Sha256};

pub fn hash_password(password: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(password.as_bytes());
    let digest = hasher.finalize();
    digest.iter().map(|b| format!("{b:02x}")).collect()
}

pub fn verify_password(password: &str, stored: &str) -> bool {
    hash_password(password) == stored
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn matches_known_vector() {
        // sha256("abc")
        assert_eq!(
            hash_password("abc"),
            "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
        );
    }

    #[test]
    fn empty_password() {
        assert_eq!(
            hash_password(""),
            "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
        );
    }

    #[test]
    fn verify_roundtrip() {
        let h = hash_password("секрет");
        assert!(verify_password("секрет", &h));
        assert!(!verify_password("другой", &h));
    }

    #[test]
    fn is_hex_lowercase() {
        let h = hash_password("x");
        assert_eq!(h.len(), 64);
        assert!(h.chars().all(|c| c.is_ascii_hexdigit() && !c.is_ascii_uppercase()));
    }
}
