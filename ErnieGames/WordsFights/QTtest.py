import sys

from PyQt5.QtGui import *
from PyQt5.QtWidgets import *


class MyWindow(QWidget):
    def __init__(self):
        super().__init__()
        self.elements = {}
        self.width = 1600
        self.height = 900
        self.initUI()

    def initUI(self):
        Img_obj = { # x, y, w, h
            "User1_Img_User": ['./Source/Images/User1.png', 0.125, 0.25, 0.22, 0.22],
            "User1_Img_Soldier": ['background.png', 0.0625, 0.49, 0.073, 0.073],
            "User1_Img_Rider": ['background.png', 0.0625, 0.59, 0.073, 0.073],
            "User1_Img_Archer": ['background.png', 0.0625, 0.69, 0.073, 0.073],
            "User1_Img_Choosed": ['background.png', 0.0625, 0.79, 0.073, 0.073],
            "User2_Img_User": ['./Source/Images/User2.png', 0.875, 0.25, 0.22, 0.22],
            "User2_Img_Soldier": ['background.png', 0.825, 0.49, 0.073, 0.073],
            "User2_Img_Rider": ['background.png', 0.825, 0.59, 0.073, 0.073],
            "User2_Img_Archer": ['background.png', 0.825, 0.69, 0.073, 0.073],
            "User2_Img_Choosed": ['background.png', 0.825, 0.79, 0.073, 0.073],
            "Img_Main": ['background.png', 0.5, 0.5, 0.98, 0.98],
        }
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
            "User2_Line_Input":["发送", 0.95, 0.89, 0.073, 0.073],
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
            self.elements[key].move(x, y)
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

        # 设置窗口的位置和大小
        self.setGeometry(0, 0, self.width, self.height)
        self.setWindowTitle('Absolute Positioning')
        self.show()

    def mouseReleaseEvent(self, event):
        pos = event.pos()
        # 打印相对位置
        print(f"Clicked at position: {pos}")

if __name__ == '__main__':
    app = QApplication(sys.argv)
    window = MyWindow()
    sys.exit(app.exec_())