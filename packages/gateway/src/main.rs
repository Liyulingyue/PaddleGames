use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        State,
    },
    response::IntoResponse,
    routing::get,
    Json, Router,
};
use futures_util::{SinkExt, StreamExt};
use protocol::{GameStatePayload, JoinGamePayload, MessageType, WSMessage};
use std::{collections::HashMap, sync::Arc};
use tokio::sync::{broadcast, RwLock};
use tower_http::cors::{Any, CorsLayer};
use tracing::{info, error};
use utils::generate_id;

struct AppState {
    rooms: RwLock<HashMap<String, Room>>,
    tx: broadcast::Sender<String>,
}

struct Room {
    id: String,
    players: HashMap<String, Player>,
    game_state: Option<GameStatePayload>,
}

struct Player {
    id: String,
    name: String,
}

async fn websocket_handler(
    ws: WebSocketUpgrade,
    State(_state): State<Arc<AppState>>,
) -> impl IntoResponse {
    ws.on_upgrade(|socket| websocket_stream(socket, _state))
}

async fn websocket_stream(
    ws: WebSocket,
    state: Arc<AppState>,
) {
    let (mut sender, mut receiver) = ws.split();
    let player_id = generate_id();
    let _player_name = format!("Player_{}", &player_id[..4]);

    info!("New player connected: {}", player_id);

    while let Some(msg) = receiver.next().await {
        match msg {
            Ok(Message::Text(text)) => {
                if let Ok(ws_msg) = WSMessage::from_bytes(text.as_bytes()) {
                    handle_message(&mut sender, ws_msg, &state, &player_id).await;
                }
            }
            Ok(Message::Binary(data)) => {
                if let Ok(ws_msg) = WSMessage::from_bytes(&data) {
                    handle_message(&mut sender, ws_msg, &state, &player_id).await;
                }
            }
            Ok(Message::Ping(data)) => {
                let _ = sender.send(Message::Pong(data)).await;
            }
            Ok(Message::Close(_)) => {
                info!("Player {} disconnected", player_id);
                break;
            }
            Err(e) => {
                error!("WebSocket error: {}", e);
                break;
            }
            _ => {}
        }
    }
}

async fn handle_message<S: SinkExt<Message> + Unpin>(
    sender: &mut S,
    msg: WSMessage,
    state: &Arc<AppState>,
    player_id: &str,
) {
    match msg.msg_type {
        MessageType::Ping => {
            let response = WSMessage::new(MessageType::Pong, serde_json::json!({}));
            let json_str = serde_json::to_string(&response).unwrap();
            let _ = sender.send(Message::Text(json_str)).await;
        }
        MessageType::JoinGame => {
            if let Ok(payload) = serde_json::from_value::<JoinGamePayload>(msg.payload) {
                let room_id = payload.game_type;
                let mut rooms = state.rooms.write().await;
                let room = rooms.entry(room_id.clone()).or_insert(Room {
                    id: room_id.clone(),
                    players: HashMap::new(),
                    game_state: None,
                });
                room.players.insert(player_id.to_string(), Player {
                    id: player_id.to_string(),
                    name: payload.player_name,
                });

                let response = WSMessage::new(
                    MessageType::MatchFound,
                    serde_json::json!({
                        "room_id": room_id,
                        "player_id": player_id
                    })
                );
                let json_str = serde_json::to_string(&response).unwrap();
                let _ = sender.send(Message::Text(json_str)).await;
            }
        }
        MessageType::PlayerAction => {
            let game_id = msg.game_id.unwrap_or_default();
            info!("Player {} action in game {}", player_id, game_id);
        }
        MessageType::GameState => {
            let rooms = state.rooms.read().await;
            if let Some(room) = rooms.get(&msg.game_id.clone().unwrap_or_default()) {
                if let Some(ref gs) = room.game_state {
                    let response = WSMessage::new(
                        MessageType::GameState,
                        serde_json::to_value(gs).unwrap()
                    ).with_game(room.id.clone());
                    let json_str = serde_json::to_string(&response).unwrap();
                    let _ = sender.send(Message::Text(json_str)).await;
                }
            }
        }
        _ => {}
    }
}

async fn health_handler() -> Json<serde_json::Value> {
    Json(serde_json::json!({
        "status": "ok",
        "service": "deepgames-gateway"
    }))
}

async fn games_handler() -> Json<serde_json::Value> {
    Json(serde_json::json!({
        "games": [
            {"id": "paddle-snacks", "name": "Paddle Snacks", "players": "1-1"},
            {"id": "paddle-cars", "name": "Paddle Cars", "players": "1-2"},
            {"id": "rl-battle", "name": "RL Battle", "players": "2-4"}
        ]
    }))
}

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt()
        .with_env_filter("info")
        .init();

    let (tx, _rx) = broadcast::channel::<String>(100);

    let state = Arc::new(AppState {
        rooms: RwLock::new(HashMap::new()),
        tx,
    });

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let app = Router::new()
        .route("/health", get(health_handler))
        .route("/api/games", get(games_handler))
        .route("/ws", get(websocket_handler))
        .layer(cors)
        .with_state(state);

    let listener = tokio::net::TcpListener::bind("0.0.0.0:7080").await.unwrap();
    info!("Gateway server running on http://0.0.0.0:7080");

    axum::serve(listener, app).await.unwrap();
}
