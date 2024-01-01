import socket
import threading
from copy import deepcopy
import time
import queue


class Client(object):
    def __init__(self, host='192.168.2.173', port=12345):
        self.host = host
        self.port = port
        self.client_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self.send_queue = queue.Queue() # 操作请求消息队列
        self.received_str = ""

    def start(self):
        self.client_socket.connect((self.host, self.port))
        self.send_thread = threading.Thread(target=self.send_messages)
        self.receive_thread = threading.Thread(target=self.receive_messages)
        self.send_thread.start()
        self.receive_thread.start()

    def send_messages(self):
        while True:
            if not self.send_queue.empty():
                send_str = self.send_queue.get()
                self.client_socket.sendall(send_str.encode())
            else:
                time.sleep(0.1)  # 稍作休眠，避免忙等待

    def receive_messages(self):
        while True:
            received_data = self.client_socket.recv(4096)
            if received_data:
                # print('Received:', received_data.decode())
                self.received_str = received_data.decode()
            else:
                print('Connection closed by server.')
                break

    def get_received_str(self):
        return deepcopy(self.received_str)

    def close_connection(self):
        self.client_socket.close()
        self.send_thread.join()
        self.receive_thread.join()

    def set_send_str(self, send_str):
        self.send_queue.put(send_str)


if __name__ == "__main__":
    # 创建客户端对象并启动线程
    client = Client()
    client.start()
    # 当需要关闭连接时，调用close_connection方法
    # client.close_connection()