#!/usr/bin/python3
# -*- coding: utf-8 -*-

"""
Thanks to 
https://blog.csdn.net/u014453898/article/details/88083173
https://github.com/maicss/PyQt-Chinese-tutorial
https://maicss.gitbooks.io/pyqt5/content/
zetcode.com
"""
import copy
import sys
import cv2
import numpy as np
import math
import sys
from PyQt5.QtWidgets import QWidget, QDesktopWidget, QApplication, QPushButton, QFileDialog, QLabel, QTextEdit, \
    QGridLayout, QFrame, QColorDialog
from PyQt5.QtCore import QTimer, Qt
from PyQt5.QtGui import QColor, QImage, QPixmap
import fastdeploy

class snack(object):
    def __init__(self, width = 500, height = 500):
        self.width = width
        self.height = height
        self.x = width/2 # x 对应图片的y，所以用width赋值可能出错，后续需要注意修改
        self.y = height/2
        self.direction = 0
        self.base_direction = math.pi/2
        self.body_list = [[int(self.x), int(self.y)]]
        self.step_size = 3
        self.body_size = 1

    def update(self):
        self.x += math.cos(self.base_direction) * self.step_size
        self.y += math.sin(self.base_direction) * self.step_size

        # bounds
        if self.direction != 0:
            self.base_direction += self.direction
            self.direction = 0
            if self.base_direction > 2 * math.pi:
                self.base_direction -= 2 * math.pi
            if self.base_direction < -2 * math.pi:
                self.base_direction += -2 * math.pi

        if self.x>=self.width:
            self.x -= self.width
        if self.x<0:
            self.x+=self.width
        if self.y>=self.height:
            self.y -= self.height
        if self.y<0:
            self.y+=self.height
        # end bounds

        for i in range(self.body_size - 1):
            self.body_list[i] = self.body_list[i + 1]

        self.body_list[self.body_size - 1] = [int(self.x), int(self.y)]

    def add_size(self):
        self.body_size += 1
        self.body_list = [[int(self.x), int(self.y)]]+self.body_list

class Window(QWidget):

    def __init__(self):
        super().__init__()

        # self.game_width, self.game_height = [500, 500]
        self.game_width, self.game_height = [QApplication.desktop().screenGeometry().height() - 200,
                                             QApplication.desktop().screenGeometry().height() - 200]
        self.img_width, self.img_height = [int((self.game_height/2-20)/3*4),
                                           int(self.game_height/2-20)]
        self.up_key_points = [5,6]
        self.down_key_points = [11,12]
        self.block_size = 8
        self.initModel()
        self.initCamera()
        self.initGame()
        self.initClock()
        self.initUI()

    def initCamera(self):
        # 开启视频通道
        self.camera_id = 0 # 为0时表示视频流来自摄像头
        self.camera = cv2.VideoCapture()  # 视频流
        self.camera.open(self.camera_id)

    def initModel(self):
        self.model = fastdeploy.vision.keypointdetection.PPTinyPose('../../Models/PP_TinyPose_128x96_infer/model.pdmodel',
                                                                    '../../Models/PP_TinyPose_128x96_infer/model.pdiparams',
                                                                    '../../Models/PP_TinyPose_128x96_infer/infer_cfg.yml')

    def initGame(self):
        self.score = 0
        self.snack = snack(self.game_width, self.game_height)
        self.map = np.ones([self.game_width, self.game_height, 3]).astype('uint8') * 255
        self.food = [np.random.randint(self.game_width-10)+5, np.random.randint(self.game_height-10)+5]

    # 初始化Camera相关信息
    def initClock(self):
        # 通过定时器读取数据
        self.flush_clock = QTimer()  # 定义定时器，用于控制显示视频的帧率
        self.flush_clock.start(60)   # 定时器开始计时30ms，结果是每过30ms从摄像头中取一帧显示
        self.flush_clock.timeout.connect(self.updata_frame)  # 若定时器结束，show_frame()

    def initUI(self):

        grid = QGridLayout()
        self.setLayout(grid)

        Choose_Color = QPushButton('重新开始', self)
        grid.addWidget(Choose_Color, 0, 0, 1, 1)
        Choose_Color.clicked.connect(self.initGame)

        ConstText = QLabel('分数', self)
        grid.addWidget(ConstText, 1, 0, 1, 1)

        self.ScoreText = QLabel(str(self.score), self)
        grid.addWidget(self.ScoreText, 2, 0, 1, 1)

        ConstText = QLabel('选择上检测点', self)
        grid.addWidget(ConstText, 4, 0, 1, 1)

        Set_Up_Points = QPushButton('鼻子', self)
        grid.addWidget(Set_Up_Points, 5, 0, 1, 1)
        Set_Up_Points.clicked.connect(self.set_up_points)

        Set_Up_Points = QPushButton('肩膀', self)
        grid.addWidget(Set_Up_Points, 6, 0, 1, 1)
        Set_Up_Points.clicked.connect(self.set_up_points)

        Set_Up_Points = QPushButton('肘部', self)
        grid.addWidget(Set_Up_Points, 7, 0, 1, 1)
        Set_Up_Points.clicked.connect(self.set_up_points)

        ConstText = QLabel('选择下检测点', self)
        grid.addWidget(ConstText, 9, 0, 1, 1)

        Set_Up_Points = QPushButton('肩膀', self)
        grid.addWidget(Set_Up_Points, 10, 0, 1, 1)
        Set_Up_Points.clicked.connect(self.set_down_points)

        Set_Up_Points = QPushButton('肘部', self)
        grid.addWidget(Set_Up_Points, 11, 0, 1, 1)
        Set_Up_Points.clicked.connect(self.set_down_points)

        Set_Up_Points = QPushButton('胯部', self)
        grid.addWidget(Set_Up_Points, 12, 0, 1, 1)
        Set_Up_Points.clicked.connect(self.set_down_points)

        Exit_Exe = QPushButton('退出', self)
        grid.addWidget(Exit_Exe, 19, 0, 1, 1)
        Exit_Exe.clicked.connect(self.close)

        self.Game_Box = QLabel()  # 定义显示视频的Label
        self.Game_Box.setFixedSize(self.game_width, self.game_height)
        grid.addWidget(self.Game_Box, 0, 1, 20, 20)

        self.Raw_Box = QLabel()  # 定义显示视频的Label
        self.Raw_Box.setFixedSize(self.img_width, self.img_height)
        grid.addWidget(self.Raw_Box, 0, 21, 10, 14)

        self.Pred_Box = QLabel()  # 定义显示视频的Label
        self.Pred_Box.setFixedSize(self.img_width, self.img_height)
        grid.addWidget(self.Pred_Box, 10, 21, 10, 14)

        self.setWindowTitle('test')
        self.show()

    def keyPressEvent(self, event):
        if event.key() == Qt.Key_Q:
            self.snack.direction += 10/360*math.pi
        if event.key() == Qt.Key_E:
            self.snack.direction -= 10/360*math.pi

    def updata_frame(self):
        self.snack.update()

        # read pic from camera
        _, img = self.camera.read()  # 从视频流中读取
        img = cv2.flip(img, 1) # 摄像头画面反转

        img2 = cv2.resize(img, (self.img_width, self.img_height))  # 把读到的帧的大小重新设置为 640x480
        showPic = QImage(img2, img2.shape[1], img2.shape[0], QImage.Format_BGR888)
        self.Raw_Box.setPixmap(QPixmap.fromImage(showPic))

        try:
            result = self.model.predict(img)

            top_y = (result.keypoints[self.up_key_points[0]][1] + result.keypoints[self.up_key_points[1]][1]) / 2
            top_x = (result.keypoints[self.up_key_points[0]][0] + result.keypoints[self.up_key_points[1]][0]) / 2
            bottom_y = (result.keypoints[self.down_key_points[0]][1] + result.keypoints[self.down_key_points[1]][1]) / 2
            bottom_x = (result.keypoints[self.down_key_points[0]][0] + result.keypoints[self.down_key_points[1]][0]) / 2

            self.snack.direction = math.acos((top_x - bottom_x) / ((top_x - bottom_x) ** 2 + (top_y - bottom_y) ** 2) ** (1 / 2)) - math.pi/2

            # print(top_x,top_y, bottom_x, bottom_y)
            # print(self.snack.direction)

            img[int(top_y)-10:int(top_y)+10,int(top_x)-10:int(top_x)+10] = [0, 0, 255]
            img[int(bottom_y) - 10:int(bottom_y) + 10, int(bottom_x) - 10:int(bottom_x) + 10] = [0, 0, 255]
            showPic = QImage(img, img.shape[1], img.shape[0], QImage.Format_BGR888)
            self.Pred_Box.setPixmap(QPixmap.fromImage(showPic))

        except:
            print('infer error')

        tmp = copy.deepcopy(self.map)
        for x, y in self.snack.body_list:
            tmp[x - self.block_size:x + self.block_size+1, y - self.block_size:y + self.block_size+1] = 0
            # tmp[x - 1:x + 2, y - 1:y + 2] = 255

        tmp[self.food[0] - self.block_size:self.food[0] + self.block_size+1, self.food[1] - self.block_size:self.food[1] + self.block_size+1] = [255, 0, 0]

        if (self.food[0]-self.snack.x)**2+(self.food[1]-self.snack.y)**2 <= (self.block_size*1.5)**2: # 直线距离
            self.food = [np.random.randint(self.game_width-10)+5, np.random.randint(self.game_height-10)+5]
            self.snack.add_size()

            self.score += 1
            self.ScoreText.setText(str(self.score))

        # showPic = QImage(self.map, self.map.shape[1], self.map.shape[0], QImage.Format_Grayscale8)
        # showPic = QImage(tmp, tmp.shape[1], tmp.shape[0], QImage.Format_Grayscale8)
        showPic = QImage(tmp, tmp.shape[1], tmp.shape[0], QImage.Format_RGB888)
        self.Game_Box.setPixmap(QPixmap.fromImage(showPic))

    def set_up_points(self):
        if self.sender().text() == '鼻子':
            self.up_key_points = [0,0]
        elif self.sender().text() == '肩膀':
            self.up_key_points = [5,6]
        elif self.sender().text() == '肘部':
            self.up_key_points = [7,8]

    def set_down_points(self):
        if self.sender().text() == '肩膀':
            self.down_key_points = [5,6]
        elif self.sender().text() == '肘部':
            self.down_key_points = [7,8]
        elif self.sender().text() == '胯部':
            self.down_key_points = [11,12]

if __name__ == '__main__':
    app = QApplication(sys.argv)
    ex = Window()
    sys.exit(app.exec_())