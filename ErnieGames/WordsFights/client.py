import socket


def start_client():
    # 创建socket对象
    client_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)

    # 连接服务器
    host = '10.36.22.106'  # 服务器的主机名或IP地址
    port = 12345  # 服务器的端口号（与服务器端代码中的端口号相同）
    client_socket.connect((host, port))

    # 循环发送和接收数据
    while True:
        data = input('Enter message: ')
        client_socket.sendall(data.encode())  # 将消息编码为字节流并发送
        received_data = client_socket.recv(1024)  # 接收服务器发送的数据
        print('Received:', received_data.decode())  # 解码接收到的数据并打印出来

    # 关闭连接
    client_socket.close()


# 启动客户端
start_client()