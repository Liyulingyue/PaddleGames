import socket
import threading


class Client:
    def __init__(self, host='192.168.2.173', port=12345):
        self.host = host
        self.port = port
        self.client_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)

    def start(self):
        self.client_socket.connect((self.host, self.port))
        self.send_thread = threading.Thread(target=self.send_messages)
        self.receive_thread = threading.Thread(target=self.receive_messages)
        self.send_thread.start()
        self.receive_thread.start()

    def send_messages(self):
        while True:
            data = input('Enter message: ')
            if data:
                self.client_socket.sendall(data.encode())

    def receive_messages(self):
        while True:
            received_data = self.client_socket.recv(1024)
            if received_data:
                print('Received:', received_data.decode())
            else:
                print('Connection closed by server.')
                break

    def close_connection(self):
        self.client_socket.close()
        self.send_thread.join()
        self.receive_thread.join()

    # 创建客户端对象并启动线程


if __name__ == "__main__":
    client = Client()
    client.start()
    # 当需要关闭连接时，调用close_connection方法
    # client.close_connection()