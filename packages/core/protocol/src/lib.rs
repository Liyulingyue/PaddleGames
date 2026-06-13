use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum ProtocolError {
    #[error("Invalid message type: {0}")]
    InvalidMessageType(String),
    #[error("Serialization error: {0}")]
    SerializationError(String),
    #[error("Deserialization error: {0}")]
    DeserializationError(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WSMessage {
    pub msg_type: MessageType,
    pub game_id: Option<String>,
    pub player_id: Option<String>,
    pub payload: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum MessageType {
    Ping,
    Pong,
    JoinGame,
    LeaveGame,
    GameState,
    PlayerAction,
    Chat,
    Error,
    MatchFound,
    Matchmaking,
}

impl WSMessage {
    pub fn new(msg_type: MessageType, payload: serde_json::Value) -> Self {
        Self {
            msg_type,
            game_id: None,
            player_id: None,
            payload,
        }
    }

    pub fn with_game(mut self, game_id: String) -> Self {
        self.game_id = Some(game_id);
        self
    }

    pub fn with_player(mut self, player_id: String) -> Self {
        self.player_id = Some(player_id);
        self
    }

    pub fn to_bytes(&self) -> Result<Vec<u8>, ProtocolError> {
        serde_json::to_vec(self)
            .map_err(|e| ProtocolError::SerializationError(e.to_string()))
    }

    pub fn from_bytes(bytes: &[u8]) -> Result<Self, ProtocolError> {
        serde_json::from_slice(bytes)
            .map_err(|e| ProtocolError::DeserializationError(e.to_string()))
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JoinGamePayload {
    pub player_name: String,
    pub game_type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GameStatePayload {
    pub tick: u64,
    pub players: Vec<PlayerInfo>,
    pub status: String,
    pub winner: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlayerInfo {
    pub id: String,
    pub name: String,
    pub x: f32,
    pub y: f32,
    pub score: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlayerActionPayload {
    pub action: String,
    pub direction: Option<Direction>,
    pub target: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Direction {
    pub x: f32,
    pub y: f32,
}
