use crate::{GameError, GameLogic, GameState, GameAction, PlayerId, Position, PlayerState, Velocity};
use serde::{Deserialize, Serialize};
use std::collections::VecDeque;

const GRID_WIDTH: usize = 20;
const GRID_HEIGHT: usize = 20;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SnakeDirection {
    pub dx: i32,
    pub dy: i32,
}

impl SnakeDirection {
    pub fn up() -> Self { SnakeDirection { dx: 0, dy: -1 } }
    pub fn down() -> Self { SnakeDirection { dx: 0, dy: 1 } }
    pub fn left() -> Self { SnakeDirection { dx: -1, dy: 0 } }
    pub fn right() -> Self { SnakeDirection { dx: 1, dy: 0 } }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SnakeSegment {
    pub x: i32,
    pub y: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SnakeState {
    pub body: VecDeque<SnakeSegment>,
    pub direction: SnakeDirection,
    pub next_direction: SnakeDirection,
    pub alive: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SnakeMetadata {
    pub snake: SnakeState,
    pub score: u32,
}

pub struct SnakeGameLogic {
    food: (i32, i32),
}

impl SnakeGameLogic {
    pub fn new() -> Self {
        Self { food: (10, 10) }
    }

    fn spawn_food(&mut self) {
        use std::time::{SystemTime, UNIX_EPOCH};
        let duration = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default();
        let nanos = duration.subsec_nanos() as usize;
        self.food.0 = (nanos % GRID_WIDTH) as i32;
        self.food.1 = ((nanos / GRID_WIDTH) % GRID_HEIGHT) as i32;
    }

    fn get_snake_metadata(state: &PlayerState) -> SnakeMetadata {
        serde_json::from_value(state.metadata.clone()).unwrap_or(SnakeMetadata {
            snake: SnakeState {
                body: VecDeque::from([SnakeSegment { x: 0, y: 0 }]),
                direction: SnakeDirection::right(),
                next_direction: SnakeDirection::right(),
                alive: true,
            },
            score: state.score,
        })
    }

    fn update_snake_metadata(state: &mut PlayerState, snake_meta: SnakeMetadata) {
        state.score = snake_meta.score;
        state.metadata = serde_json::to_value(snake_meta).unwrap();
    }

    fn direction_to_angle(dx: i32, dy: i32) -> f32 {
        match (dx, dy) {
            (0, -1) => 0.0,
            (1, 0) => 90.0,
            (0, 1) => 180.0,
            (-1, 0) => 270.0,
            _ => 0.0,
        }
    }
}

impl Default for SnakeGameLogic {
    fn default() -> Self {
        Self::new()
    }
}

impl GameLogic for SnakeGameLogic {
    fn tick(&mut self, state: &mut GameState, actions: Vec<GameAction>) -> Result<(), GameError> {
        if state.players.is_empty() {
            return Err(GameError::InvalidState("No players".to_string()));
        }

        for action in &actions {
            if let Some(player) = state.players.get_mut(&action.player_id) {
                let mut snake_meta = Self::get_snake_metadata(player);

                if let Some(dir) = action.payload.get("direction").and_then(|d| d.as_str()) {
                    snake_meta.snake.next_direction = match dir {
                        "up" => SnakeDirection::up(),
                        "down" => SnakeDirection::down(),
                        "left" => SnakeDirection::left(),
                        "right" => SnakeDirection::right(),
                        _ => snake_meta.snake.next_direction.clone(),
                    };
                }

                if !snake_meta.snake.alive {
                    continue;
                }

                snake_meta.snake.direction = snake_meta.snake.next_direction.clone();
                let head = snake_meta.snake.body.front().unwrap();
                let new_head = SnakeSegment {
                    x: head.x + snake_meta.snake.direction.dx,
                    y: head.y + snake_meta.snake.direction.dy,
                };

                if new_head.x < 0 || new_head.x >= GRID_WIDTH as i32
                    || new_head.y < 0 || new_head.y >= GRID_HEIGHT as i32
                {
                    snake_meta.snake.alive = false;
                    Self::update_snake_metadata(player, snake_meta);
                    continue;
                }

                for segment in snake_meta.snake.body.iter().skip(1) {
                    if segment.x == new_head.x && segment.y == new_head.y {
                        snake_meta.snake.alive = false;
                        break;
                    }
                }

                if !snake_meta.snake.alive {
                    Self::update_snake_metadata(player, snake_meta);
                    continue;
                }

                snake_meta.snake.body.push_front(new_head.clone());

                if new_head.x == self.food.0 && new_head.y == self.food.1 {
                    snake_meta.score += 10;
                    self.spawn_food();
                } else {
                    snake_meta.snake.body.pop_back();
                }

                let angle = Self::direction_to_angle(snake_meta.snake.direction.dx, snake_meta.snake.direction.dy);
                player.position.x = new_head.x as f32 / GRID_WIDTH as f32;
                player.position.y = new_head.y as f32 / GRID_HEIGHT as f32;
                player.velocity.x = angle.cos() * 0.1;
                player.velocity.y = angle.sin() * 0.1;

                Self::update_snake_metadata(player, snake_meta);
            }
        }

        state.status = crate::GameStatus::Running;
        Ok(())
    }

    fn is_finished(&self, state: &GameState) -> bool {
        state.players.values().all(|p| {
            let meta: Result<SnakeMetadata, _> = serde_json::from_value(p.metadata.clone());
            meta.map(|m| !m.snake.alive).unwrap_or(true)
        })
    }

    fn get_winner(&self, state: &GameState) -> Option<PlayerId> {
        state.players.iter()
            .max_by_key(|(_, p)| p.score)
            .map(|(id, _)| id.clone())
    }
}
