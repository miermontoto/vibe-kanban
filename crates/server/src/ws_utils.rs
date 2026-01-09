use anyhow;
use axum::extract::ws::{Message as WsMessage, WebSocket};
use futures_util::{SinkExt, StreamExt};
use std::time::Duration;

/// helper para manejar streams de websocket con heartbeat automático
/// envia ping cada 30s para mantener la conexión viva
pub async fn stream_with_heartbeat(
    socket: WebSocket,
    mut data_stream: impl futures_util::Stream<Item = Result<WsMessage, anyhow::Error>> + Unpin + Send + 'static,
) -> anyhow::Result<()> {
    use tokio::time::{interval, MissedTickBehavior};

    let (mut sender, mut receiver) = socket.split();

    // crear stream de pings cada 30 segundos
    let mut ping_interval = interval(Duration::from_secs(30));
    ping_interval.set_missed_tick_behavior(MissedTickBehavior::Skip);

    // combinar stream de datos, pings y mensajes del cliente en un solo select
    loop {
        tokio::select! {
            // mensaje del stream de datos
            item = data_stream.next() => {
                match item {
                    Some(Ok(msg)) => {
                        if sender.send(msg).await.is_err() {
                            break; // cliente desconectado
                        }
                    }
                    Some(Err(e)) => {
                        tracing::error!("stream error: {}", e);
                        break;
                    }
                    None => {
                        // stream terminado normalmente
                        break;
                    }
                }
            }
            // ping periódico para mantener conexión viva
            _ = ping_interval.tick() => {
                if sender.send(WsMessage::Ping(vec![].into())).await.is_err() {
                    tracing::debug!("failed to send ping, client disconnected");
                    break;
                }
            }
            // mensajes del cliente (pongs, close, etc)
            msg = receiver.next() => {
                match msg {
                    Some(Ok(WsMessage::Close(_))) => {
                        tracing::debug!("client sent close frame");
                        break;
                    }
                    Some(Err(_)) => {
                        tracing::debug!("error receiving from client");
                        break;
                    }
                    None => {
                        // cliente cerró conexión
                        tracing::debug!("client closed connection");
                        break;
                    }
                    // ignorar pongs y otros mensajes (solo los procesamos para mantener conexión viva)
                    _ => {}
                }
            }
        }
    }

    Ok(())
}
