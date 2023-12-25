import socket


def start_server():
    # 创建socket对象
    server_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)

    # 获取本地主机名
    host = socket.gethostname()

    # 获取主机名对应的IP地址
    ip_address = socket.gethostbyname(host)

    # 设置端口号
    port = 12345

    # 绑定端口号
    server_socket.bind((host, port))

    # 开始监听连接请求
    server_socket.listen(1)
    print("Server started on IP:", ip_address, "Port:", port)

    while True:
        # 接受连接请求并返回连接对象和客户端地址
        conn, addr = server_socket.accept()
        print("Connected by", addr)

        # 循环接收并发送数据
        while True:
            data = conn.recv(1024)
            if not data:
                break
            conn.sendall(data)

            # 关闭连接
        conn.close()

        # 关闭服务器套接字
    server_socket.close()


# 启动服务器
start_server()