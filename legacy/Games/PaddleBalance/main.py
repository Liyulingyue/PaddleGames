#!/usr/bin/python3
# -*- coding: utf-8 -*-

"""
Thanks to
https://blog.csdn.net/u014453898/article/details/88083173
https://github.com/maicss/PyQt-Chinese-tutorial
https://maicss.gitbooks.io/pyqt5/content/
zetcode.com
"""
from Balance import *

import copy
import sys
import cv2
import numpy as np
import math
import sys
from PyQt5.QtWidgets import QWidget, QDesktopWidget, QApplication, QPushButton, QFileDialog, QLabel, QTextEdit, \
    QGridLayout, QFrame, QColorDialog, QMessageBox
from PyQt5.QtCore import QTimer, Qt
from PyQt5.QtGui import QColor, QImage, QPixmap
import fastdeploy

class Window(QWidget):

    def __init__(self):
        super().__init__()

        self.map = np.ones([500, 500, 3]).astype('uint8') * 255

        self.up_key_points = [0,0]
        self.down_key_points = [5,6]
        # init game object
        self.angle = 0
        self.balance = Balance()
        # self.balance = {'length': 200, 'angle':0}
        # self.me = {'position':0, 'speed':0}
        # tmp game object
        self.x = 250
        self.y = 250

        self.initModel()
        self.initCamera()
        self.initClock()
        self.initUI()

    def initUI(self):

        grid = QGridLayout()
        self.setLayout(grid)

        self.Game_Box = QLabel()  # 定义显示视频的Label
        self.Game_Box.setFixedSize(500, 500)
        grid.addWidget(self.Game_Box, 0, 0, 20, 20)
        self.Game_Box.setMouseTracking(True)

        self.Pred_Box = QLabel()  # 定义显示视频的Label
        self.Pred_Box.setFixedSize(500, 500)
        grid.addWidget(self.Pred_Box, 0, 20, 20, 20)

        self.setWindowTitle('test')
        self.show()

    def initClock(self):
        # 通过定时器读取数据
        self.flush_clock = QTimer()  # 定义定时器，用于控制显示视频的帧率
        self.flush_clock.start(30)   # 定时器开始计时30ms，结果是每过30ms从摄像头中取一帧显示
        self.flush_clock.timeout.connect(self.updata_frame)  # 若定时器结束，show_frame()

    def initCamera(self):
        # 开启视频通道
        self.camera_id = 0 # 为0时表示视频流来自摄像头
        self.camera = cv2.VideoCapture()  # 视频流
        self.camera.open(self.camera_id)

    def initModel(self):
        self.model = fastdeploy.vision.keypointdetection.PPTinyPose('../../Models/PP_TinyPose_128x96_infer/model.pdmodel',
                                                                    '../../Models/PP_TinyPose_128x96_infer/model.pdiparams',
                                                                    '../../Models/PP_TinyPose_128x96_infer/infer_cfg.yml')

    def inferModel(self):
        # read pic from camera
        _, img = self.camera.read()  # 从视频流中读取
        img = cv2.flip(img, 1) # 摄像头画面反转
        img2 = cv2.resize(img, (500, 500))  # 把读到的帧的大小重新设置为 640x480
        showPic = QImage(img2, img2.shape[1], img2.shape[0], QImage.Format_BGR888)
        self.Pred_Box.setPixmap(QPixmap.fromImage(showPic))

        try:
            result = self.model.predict(img)

            top_y = (result.keypoints[self.up_key_points[0]][1] + result.keypoints[self.up_key_points[1]][1]) / 2
            top_x = (result.keypoints[self.up_key_points[0]][0] + result.keypoints[self.up_key_points[1]][0]) / 2
            bottom_y = (result.keypoints[self.down_key_points[0]][1] + result.keypoints[self.down_key_points[1]][1]) / 2
            bottom_x = (result.keypoints[self.down_key_points[0]][0] + result.keypoints[self.down_key_points[1]][0]) / 2

            direction = math.acos((top_x - bottom_x) / ((top_x - bottom_x) ** 2 + (top_y - bottom_y) ** 2) ** (1 / 2)) - math.pi/2
            self.angle = -direction
            # self.me['speed'] = -direction * 10
            # print(self.direction)

            # 模糊
            img = cv2.resize(img, (40, 40))
            img = cv2.resize(img, (640, 640), interpolation=cv2.INTER_NEAREST)

            img[int(top_y)-10:int(top_y)+10,int(top_x)-10:int(top_x)+10] = [0, 0, 255]
            img[int(bottom_y) - 10:int(bottom_y) + 10, int(bottom_x) - 10:int(bottom_x) + 10] = [0, 0, 255]
            showPic = QImage(img, img.shape[1], img.shape[0], QImage.Format_BGR888)
            self.Pred_Box.setPixmap(QPixmap.fromImage(showPic))

        except:
            self.angle = 0 # 推理失败认为本周期不添加力


    def updata_frame(self):
        self.inferModel() # infer and show

        # current_map = copy.deepcopy(self.map)
        current_map = copy.deepcopy(self.map)
        self.balance.draw_canvas(current_map)
        showPic = QImage(current_map, current_map.shape[1], current_map.shape[0], QImage.Format_RGB888)
        self.Game_Box.setPixmap(QPixmap.fromImage(showPic))

        # update balance
        self.balance.update(self.angle)

        # judge game
        state, game_over_reason = self.balance.get_status()
        if state:
            QMessageBox.information(self,
                                    "Oops！",
                                    game_over_reason+"游戏结束！\n您坚持了"+self.balance.show_time+'\n点击以重新开始游戏',
                                    QMessageBox.Yes)
            self.balance.__init__()

    '''
    def mousePressEvent(self, event):
        x = event.pos().x()
        y = event.pos().y()

        self.current_map = copy.deepcopy(self.map)
        self.current_map[240:260, x-10:x+10] = 0
    '''

    def mouseMoveEvent(self, event):

        s = event.windowPos()
        self.setMouseTracking(True)
        self.x = event.pos().x()
        self.y = event.pos().y()

        self.me['position'] = self.x - 250



if __name__ == '__main__':
    app = QApplication(sys.argv)
    ex = Window()
    sys.exit(app.exec_())