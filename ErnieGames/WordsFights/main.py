import sys

from PyQt5.QtGui import *
from PyQt5.QtWidgets import *
from PyQt5.QtCore import *
from FightObject import fightobj
from utils import *
import cv2
from client import Client
import json

class MyWindow(QWidget):
    def __init__(self):
        super().__init__()
        self.elements = {}
        self.width = 1600
        self.height = 900
        self.gameobj = fightobj.get_default_dict()
        self.initUI()
        self.draw_frame()
        self.client = Client()
        self.client.start()
        self.initClock()
        self.user = "User1"

    def initUI(self):
        Img_obj = { # x, y, w, h
            "User1_Img_User": ['./Source/Images/User1.png', 0.125, 0.25, 0.22, 0.22],
            "User1_Img_Soldier": ['./Source/Images/Soldier1.png', 0.0625, 0.49, 0.073, 0.073],
            "User1_Img_Rider": ['./Source/Images/Rider1.png', 0.0625, 0.59, 0.073, 0.073],
            "User1_Img_Archer": ['./Source/Images/Archer1.png', 0.0625, 0.69, 0.073, 0.073],
            "User1_Img_Choosed": ['./Source/Images/Background.png', 0.0625, 0.79, 0.073, 0.073],
            "User2_Img_User": ['./Source/Images/User2.png', 0.875, 0.25, 0.22, 0.22],
            "User2_Img_Soldier": ['./Source/Images/Soldier2.png', 0.825, 0.49, 0.073, 0.073],
            "User2_Img_Rider": ['./Source/Images/Rider2.png', 0.825, 0.59, 0.073, 0.073],
            "User2_Img_Archer": ['./Source/Images/Archer2.png', 0.825, 0.69, 0.073, 0.073],
            "User2_Img_Choosed": ['./Source/Images/Background.png', 0.825, 0.79, 0.073, 0.073],
            "Img_Main": ['./Source/Images/Background.png', 0.5, 0.5, 0.98, 0.98],
        }
        self.Img_obj = Img_obj
        Text_obj = {
            "User1_Text_User": ['用户1', 0.125, 0.4, 0.18, 0.067],
            "User1_Text_Soldier": ['士兵', 0.1375, 0.49, 0.18, 0.073],
            "User1_Text_Rider": ['骑兵', 0.1375, 0.59, 0.18, 0.073],
            "User1_Text_Archer": ['弓兵', 0.1375, 0.69, 0.18, 0.073],
            "User1_Text_Choosed": ['未选择', 0.1375, 0.79, 0.18, 0.073],
            "User2_Text_User": ['用户2', 0.875, 0.4, 0.18, 0.067],
            "User2_Text_Soldier": ['士兵', 0.9125, 0.49, 0.18, 0.073],
            "User2_Text_Rider": ['骑兵', 0.9125, 0.59, 0.18, 0.073],
            "User2_Text_Archer": ['弓兵', 0.9125, 0.69, 0.18, 0.073],
            "User2_Text_Choosed": ['未选择', 0.9125, 0.79, 0.18, 0.073]
        }
        Line_obj = {
            "User1_Line_Input":["", 0.08, 0.89, 0.18, 0.073],
            "User2_Line_Input":["", 0.85, 0.89, 0.18, 0.073],
        }
        Button_obj = {
            "User1_Button_Confirm":["发送", 0.18, 0.89, 0.073, 0.073],
            "User2_Button_Confirm":["发送", 0.95, 0.89, 0.073, 0.073],
        }

        for key in Img_obj:
            self.elements[key] = QLabel(self)
            fig_path, x, y, w, h = Img_obj[key]
            w = int(w * self.height) if w<1 else w
            h = int(h * self.height) if h<1 else h
            x = int(x * self.width - w / 2) if x<1 else x
            y = int(y * self.height - h / 2) if y<1 else y
            pixmap = QPixmap(fig_path)  # 加载本地图片
            pixmap = pixmap.scaled(w, h)
            self.elements[key].setPixmap(pixmap)  # 将图片设置到QLabel中
            # self.elements[key].setFixedSize(w, h)
            # self.elements[key].move(x, y)
            self.elements[key].setGeometry(x, y, w, h)  # 设置标签的位置和大小
        for key in Text_obj:
            text, x, y, w, h = Text_obj[key]
            w = int(w * self.height) if w<1 else w
            h = int(h * self.height) if h<1 else h
            x = int(x * self.width - w / 2) if x<1 else x
            y = int(y * self.height - h / 2) if y<1 else y
            self.elements[key] = QLabel(self)
            self.elements[key].setText(text)
            # self.elements[key].move(x, y)
            self.elements[key].setGeometry(x, y, w, h)  # 设置标签的位置和大小
        for key in Line_obj:
            text, x, y, w, h = Line_obj[key]
            w = int(w * self.height) if w<1 else w
            h = int(h * self.height) if h<1 else h
            x = int(x * self.width - w / 2) if x<1 else x
            y = int(y * self.height - h / 2) if y<1 else y
            self.elements[key] = QLineEdit(self)
            self.elements[key].move(x, y)
        for key in Button_obj:
            text, x, y, w, h = Button_obj[key]
            w = int(w * self.height) if w<1 else w
            h = int(h * self.height) if h<1 else h
            x = int(x * self.width - w / 2) if x<1 else x
            y = int(y * self.height - h / 2) if y<1 else y
            self.elements[key] = QPushButton(text, self)
            self.elements[key].move(x, y)
            self.elements[key].clicked.connect(self.send_prompt)

        # 设置窗口的位置和大小
        self.setGeometry(0, 0, self.width, self.height)
        self.setWindowTitle('Words Fight')
        self.show()

    def initClock(self):
        # 通过定时器读取数据
        self.flush_clock = QTimer()  # 定义定时器，用于控制显示视频的帧率
        self.flush_clock.start(100)   # 定时器开始计时100ms
        self.flush_clock.timeout.connect(self.update_frame)  # 若定时器结束，show_frame()

    def mouseReleaseEvent(self, event):
        pos = event.pos()
        x_real = pos.x()
        y_real = pos.y()
        x = pos.x() / self.width
        y = pos.y() / self.height
        if event.button() == Qt.LeftButton:
            for key in ["Soldier", "Rider", "Archer"]:
                flag = 0
                hp, x_percent, y_percent, _, _, _ = self.gameobj[self.user][key]
                if hp<=0: continue
                _, _x, _y, _w, _h = self.Img_obj[f"{self.user}_Img_{key}"]
                if _x-_w*self.height/self.width/2<x<_x+_w*self.height/self.width/2 and _y-_h/2<y<_y+_h/2:
                    flag = 1
                _, __x, __y, __w, __h = self.Img_obj[f"Img_Main"]
                _x = __x-__w*self.height/self.width/2+__w*self.height/self.width*x_percent
                _y = __y-__h/2+__h*y_percent
                if _x-_w*self.height/self.width/2<x<_x+_w*self.height/self.width/2 and _y-_h/2<y<_y+_h/2:
                    flag = 1
                if flag == 1:
                    self.Img_obj[f"{self.user}_Img_Choosed"][0] = f'./Source/Images/{key}1.png'
                    fig_path, x, y, w, h = self.Img_obj[f"{self.user}_Img_Choosed"]
                    w = int(w * self.height) if w < 1 else w
                    h = int(h * self.height) if h < 1 else h
                    x = int(x * self.width - w / 2) if x < 1 else x
                    y = int(y * self.height - h / 2) if y < 1 else y
                    pixmap = QPixmap(fig_path)  # 加载本地图片
                    pixmap = pixmap.scaled(w, h)
                    self.elements[f"{self.user}_Img_Choosed"].setPixmap(pixmap)  # 将图片设置到QLabel中
                    self.elements[f"{self.user}_Text_Choosed"].setText(f"{key}")
        elif event.button() == Qt.RightButton:
            _, _x, _y, _w, _h = self.Img_obj[f"Img_Main"]
            _x_real = _x*self.width - _w/2*self.height
            _y_real = _y*self.height - _h/2*self.height
            x_based = x_real-_x_real
            y_based = y_real-_y_real
            _w_real = _w*self.height
            _h_real = _h*self.height
            new_x_p = x_based/_w_real
            new_y_p = y_based/_h_real

            if _x-_w*self.height/self.width/2<x<_x+_w*self.height/self.width/2 and _y-_h/2<y<_y+_h/2:
                key = self.elements[f"{self.user}_Text_Choosed"].text()
                if key in ["Soldier", "Rider", "Archer"]:
                    self.client.set_send_str(f"MOVE,{self.user},{key},{str(new_x_p)},{str(new_y_p)}")
                    # self.gameobj["User1"][key][1] = new_x_p
                    # self.gameobj["User1"][key][2] = new_y_p
                    # self.draw_frame()
        else:
            pass

    def update_frame(self):
        raw_str = self.client.get_received_str()
        if raw_str != "":
            self.gameobj = json.loads(raw_str)
            self.draw_frame()

    def draw_frame(self):
        img = get_img_and_resize(self.Img_obj, "Img_Main")
        for key in self.gameobj["User1"]:
            hp, x_percent, y_percent, _, _, prompt = self.gameobj["User1"][key]
            self.elements[f"User1_Text_{key}"].setText(f"血量: {str(hp)}\n阵法: {prompt}")
            if hp<=0: continue
            part_img = get_img_and_resize(self.Img_obj, f"User1_Img_{key}")
            img = paste_image(img, part_img, [x_percent, y_percent])
        for key in self.gameobj["User2"]:
            hp, x_percent, y_percent, _, _, prompt = self.gameobj["User2"][key]
            self.elements[f"User2_Text_{key}"].setText(f"血量: {str(hp)}\n阵法: {prompt}")
            if hp<=0: continue
            part_img = get_img_and_resize(self.Img_obj, f"User2_Img_{key}")
            img = paste_image(img, part_img, [x_percent, y_percent])
        image = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        height, width, channel = image.shape
        bytesPerLine = 3 * width
        qtImage = QImage(image.data, width, height, bytesPerLine, QImage.Format_RGB888)
        pixmap = QPixmap.fromImage(qtImage)
        self.elements["Img_Main"].setPixmap(pixmap)  # 将图片设置到QLabel中

    def send_prompt(self):
        prompt = self.elements[f"{self.user}_Line_Input"].text()
        key = self.elements[f"{self.user}_Text_Choosed"].text()
        self.client.set_send_str(f"ERNIE,{self.user},{key},{prompt}")

if __name__ == '__main__':
    app = QApplication(sys.argv)
    window = MyWindow()
    sys.exit(app.exec_())