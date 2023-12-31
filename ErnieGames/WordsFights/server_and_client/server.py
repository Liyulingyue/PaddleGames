import socket
import threading
import queue
import time
from ErnieGames.WordsFights.llm.chat_llm import analyse_word
from ErnieGames.WordsFights.FightObject import FightObject

class Server:
    def __init__(self, port=12345):
        self.port = port
        self.server_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self.host = socket.gethostname() # 获取本地主机名
        self.ip_address = socket.gethostbyname(self.host) # 获取主机名对应的IP地址
        self.connections = []
        self.lock = threading.Lock()
        self.message_queue = queue.Queue()  # 添加发送消息队列
        self.move_queue = queue.Queue() # 移动请求消息队列
        self.ernie_queue = queue.Queue() # prompt消息队列
        self.ernied_queue = queue.Queue() # 处理好的prompt消息队列
        self.fight_obj = FightObject()

    def start(self):
        self.server_socket.bind((self.ip_address, self.port))
        self.server_socket.listen(1)
        print(f"Server started on IP: {self.ip_address} Port: {self.port}")

        # 线程1：监听新的连接
        threading.Thread(target=self.listen_for_connections).start()
        # 线程2：处理消息队列
        threading.Thread(target=self.process_message_queue).start()
        # 线程3：LLM队列
        threading.Thread(target=self.process_ernie_queue).start()
        # 线程4：定期更新fight_obj对象
        threading.Thread(target=self.update_fight_obj, daemon=True).start()  # 设置为守护线程，随主程序退出而退出

    def update_fight_obj(self):
        """定期更新fight_obj对象的方法"""
        while True:
            while not self.move_queue.empty():
                conn, addr, data = self.move_queue.get()
                move_str = data.decode()
                _, user, role, target_x, target_y = move_str.split(",")
                self.fight_obj.set_target_pos(user, role, [float(target_x), float(target_y)])
            while not self.ernied_queue.empty():
                user,role,ATK,DEF,elem,prompt = self.ernied_queue.get()
                self.fight_obj.set_prompt_info(user, role, ATK=ATK, DEF=DEF, element=elem, prompt=prompt)
            self.fight_obj.update()  # 调用fight_obj的update方法
            self.message_queue.put(self.fight_obj.get_dispatched_str())
            time.sleep(0.1)  # 等待0.1秒

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
            try:
                data = conn.recv(1024)
            except:
                conn.close()
                self.connections.remove((conn, addr))
                break
            if data:
                print(f"Received from {addr}: {data.decode()}")
                if data.decode() == "quit":
                    conn.close()
                    with self.lock:
                        self.connections = [(c, a) for c, a in self.connections if c != conn]
                    print(f"Disconnected by {addr}")
                else:
                    with self.lock:
                        if not data.decode().startswith("ERNIE"):
                            # if data.decode().startswith("MOVE"):
                            self.move_queue.put((conn, addr, data))  # 将消息添加到队列中
                            print(data.decode())
                        else:
                            self.ernie_queue.put((conn, addr, data))  # 将消息添加到队列中
            else:
                break

    def process_message_queue(self):
        while True:
            if not self.message_queue.empty():
                data = self.message_queue.get()  # 获取并移除队列中的第一个消息
                with self.lock:
                    for c, addr in self.connections:
                        # if c != conn:  # 避免将消息发回给发送者自己
                        try:
                            c.sendall(data.encode())
                        except:
                            c.close()
                            self.connections.remove((c, addr))
                # print(f"Broadcasted message: {data}")
            else:
                time.sleep(0.1)  # 稍作休眠，避免忙等待

    def process_ernie_queue(self):
        while True:
            if not self.ernie_queue.empty():
                conn, addr, data = self.ernie_queue.get()  # 获取并移除队列中的第一个消息
                ernie_str = data.decode()
                _, user, role, prompt = ernie_str.split(",")
                # answer = get_llm_answer(data.decode())
                # TODO: 以多线程的方式执行LLM，即对于每个Prompt都开一个线程，互不干扰，可能需要考虑搞6个sdk支持并发
                # TODO: 增加方法，用于处理try-except的情况
                json_dict = analyse_word(prompt)
                ATK = json_dict['攻击力']
                DEF = json_dict['防御力']
                elem = json_dict["属性"]
                self.ernied_queue.put((user,role,ATK,DEF,elem,prompt))
            else:
                time.sleep(0.1)  # 稍作休眠，避免忙等待

    def close(self):
        self.server_socket.close()
        print("Server stopped.")

# 启动服务器

if __name__ == "__main__":
    server = Server()
    server.start()