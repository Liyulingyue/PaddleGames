import sys

from PyQt5.QtGui import QPixmap
from PyQt5.QtWidgets import QApplication, QWidget, QPushButton, QLabel


class MyWindow(QWidget):
    def __init__(self):
        super().__init__()
        self.elements = {}
        self.width = 1600
        self.height = 800
        self.initUI()

    def initUI(self):
        Img_obj = { # x, y, w, h
            "User1_Img_User": ['background.png', 50, 50, 50, 50],
            "User1_Img_Soldier": ['background.png', 50, 110, 50, 50],
            "User1_Img_Rider": ['background.png', 50, 170, 50, 50],
            "User1_Img_Archer": ['background.png', 50, 230, 50, 50],
            "User1_Img_Choosed": ['background.png', 50, 290, 50, 50],
            "User2_Img_User": ['background.png', 1400, 50, 50, 50],
            "User2_Img_Soldier": ['background.png', 1400, 110, 50, 50],
            "User2_Img_Rider": ['background.png', 1400, 170, 50, 50],
            "User2_Img_Archer": ['background.png', 1400, 230, 50, 50],
            "User2_Img_Choosed": ['background.png', 1400, 290, 50, 50],
            "Img_Main": ['background.png', 300, 50, 700, 700],
        }
        Text_obj = {
            "User1_Text_User": ['用户1', 110, 50, 50, 50],
            "User1_Text_Soldier": ['士兵', 110, 110, 50, 50],
            "User1_Text_Rider": ['骑兵', 110, 170, 50, 50],
            "User1_Text_Archer": ['弓兵', 110, 230, 50, 50],
            "User1_Text_Choosed": ['未选择', 110, 290, 50, 50],
            "User2_Text_User": ['用户2', 1460, 50, 50, 50],
            "User2_Text_Soldier": ['士兵', 1460, 110, 50, 50],
            "User2_Text_Rider": ['骑兵', 1460, 170, 50, 50],
            "User2_Text_Archer": ['弓兵', 1460, 230, 50, 50],
            "User2_Text_Choosed": ['未选择', 1460, 290, 50, 50]
        }

        for key in Img_obj:
            self.elements[key] = QLabel(self)
            pixmap = QPixmap(Img_obj[key][0])  # 加载本地图片
            self.elements[key].setPixmap(pixmap)  # 将图片设置到QLabel中
            self.elements[key].setGeometry(Img_obj[key][1], Img_obj[key][2], Img_obj[key][3], Img_obj[key][4])  # 设置标签的位置和大小
        for key in Text_obj:
            self.elements[key] = QLabel(Text_obj[key][0], self)
            self.elements[key].move(Text_obj[key][1], Text_obj[key][2])

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