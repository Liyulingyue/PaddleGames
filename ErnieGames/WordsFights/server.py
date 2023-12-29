import socket
import threading
import queue
import time


class Server:
    def __init__(self, port=12345):
        self.port = port
        self.server_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self.host = socket.gethostname() # 获取本地主机名
        self.ip_address = socket.gethostbyname(self.host) # 获取主机名对应的IP地址
        self.connections = []
        self.lock = threading.Lock()
        self.message_queue = queue.Queue()  # 添加消息队列

    def start(self):
        self.server_socket.bind((self.ip_address, self.port))
        self.server_socket.listen(1)
        print(f"Server started on IP: {self.ip_address} Port: {self.port}")

        # 线程1：监听新的连接
        threading.Thread(target=self.listen_for_connections).start()

        # 线程2：处理消息队列
        threading.Thread(target=self.process_message_queue).start()

    def listen_for_connections(self):
        while True:
            conn, addr = self.server_socket.accept()
            print(f"Connected by {addr}")
            with self.lock:
                self.connections.append((conn, addr))
                # 为每个新连接启动一个线程来监听其消息
            threading.Thread(target=self.listen_for_messages, args=(conn, addr)).start()

    def listen_for_messages(self, conn, addr):
        while True:
            data = conn.recv(1024)
            if data:
                print(f"Received from {addr}: {data.decode()}")
                if data.decode() == "quit":
                    conn.close()
                    with self.lock:
                        self.connections = [(c, a) for c, a in self.connections if c != conn]
                    print(f"Disconnected by {addr}")
                else:
                    with self.lock:
                        self.message_queue.put((conn, addr, data))  # 将消息添加到队列中
            else:
                break

    def process_message_queue(self):
        while True:
            if not self.message_queue.empty():
                conn, addr, data = self.message_queue.get()  # 获取并移除队列中的第一个消息
                with self.lock:
                    for c, addr in self.connections:
                        # if c != conn:  # 避免将消息发回给发送者自己
                        c.sendall(data)
                print(f"Broadcasted {addr} message: {data.decode()}")
            else:
                time.sleep(0.1)  # 稍作休眠，避免忙等待

    def close(self):
        self.server_socket.close()
        print("Server stopped.")

# 启动服务器

if __name__ == "__main__":
    server = Server()
    server.start()