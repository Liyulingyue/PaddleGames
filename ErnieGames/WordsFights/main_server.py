from WFPackage.server_and_client.server import Server

if __name__ == "__main__":
    time_step = 0.02
    server = Server(time_step=time_step)
    server.start()
