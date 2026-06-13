pub mod snake;

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum GameError {
    #[error("Invalid game state: {0}")]
    InvalidState(String),
    #[error("Player not found: {0}")]
    PlayerNotFound(String),
    #[error("Action rejected: {0}")]
    ActionRejected(String),
}

#[derive(Debug, Clone, Serialize, Deserialize, Eq, Hash, PartialEq)]
pub struct PlayerId(pub String);

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GameState {
    pub game_id: String,
    pub players: HashMap<PlayerId, PlayerState>,
    pub tick: u64,
    pub status: GameStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum GameStatus {
    Waiting,
    Running,
    Paused,
    Finished { winner: Option<PlayerId> },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlayerState {
    pub position: Position,
    pub velocity: Velocity,
    pub score: u32,
    pub metadata: serde_json::Value,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct Position {
    pub x: f32,
    pub y: f32,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct Velocity {
    pub x: f32,
    pub y: f32,
}

pub trait GameLogic: Send + Sync {
    fn tick(&mut self, state: &mut GameState, actions: Vec<GameAction>) -> Result<(), GameError>;
    fn is_finished(&self, state: &GameState) -> bool;
    fn get_winner(&self, state: &GameState) -> Option<PlayerId>;
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GameAction {
    pub player_id: PlayerId,
    pub action_type: ActionType,
    pub payload: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ActionType {
    Move,
    Rotate,
    Fire,
    UseItem,
    Custom(String),
}

pub struct GameEngine<G: GameLogic> {
    logic: G,
    state: GameState,
}

impl<G: GameLogic> GameEngine<G> {
    pub fn new(game_id: String, logic: G) -> Self {
        Self {
            logic,
            state: GameState {
                game_id,
                players: HashMap::new(),
                tick: 0,
                status: GameStatus::Waiting,
            },
        }
    }

    pub fn add_player(&mut self, player_id: PlayerId, initial_position: Position) -> Result<(), GameError> {
        if self.state.players.contains_key(&player_id) {
            return Err(GameError::PlayerNotFound(format!("{:?}", player_id)));
        }
        self.state.players.insert(player_id, PlayerState {
            position: initial_position,
            velocity: Velocity { x: 0.0, y: 0.0 },
            score: 0,
            metadata: serde_json::json!({}),
        });
        Ok(())
    }

    pub fn process_tick(&mut self, actions: Vec<GameAction>) -> Result<&GameState, GameError> {
        self.logic.tick(&mut self.state, actions)?;
        self.state.tick += 1;
        if self.logic.is_finished(&self.state) {
            self.state.status = GameStatus::Finished {
                winner: self.logic.get_winner(&self.state)
            };
        }
        Ok(&self.state)
    }

    pub fn state(&self) -> &GameState {
        &self.state
    }
}

impl Position {
    pub fn distance_to(&self, other: &Position) -> f32 {
        ((self.x - other.x).powi(2) + (self.y - other.y).powi(2)).sqrt()
    }
}