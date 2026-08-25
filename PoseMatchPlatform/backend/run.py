import uvicorn
import os

if __name__ == "__main__":
    # 自签证书存在时启用 HTTPS（WebCodecs 需要安全上下文）
    cert_path = os.path.join(os.path.dirname(__file__), "..", "cert.pem")
    key_path = os.path.join(os.path.dirname(__file__), "..", "key.pem")

    ssl_kwargs = {}
    if os.path.exists(cert_path) and os.path.exists(key_path):
        ssl_kwargs = {"ssl_certfile": cert_path, "ssl_keyfile": key_path}
        print(f"[HTTPS] 检测到自签证书，启用 HTTPS")
    else:
        print("[HTTP] 未检测到证书，使用 HTTP（localhost 仍为安全上下文）")

    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        **ssl_kwargs,
    )
