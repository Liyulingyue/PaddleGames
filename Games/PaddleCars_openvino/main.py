#!/usr/bin/python3
# -*- coding: utf-8 -*-

"""
Thanks to
https://blog.csdn.net/u014453898/article/details/88083173
https://github.com/maicss/PyQt-Chinese-tutorial
https://maicss.gitbooks.io/pyqt5/content/
zetcode.com
"""
import os
import copy
import cv2
import numpy as np
import math
import sys
from PyQt5.QtWidgets import QWidget, QApplication, QLabel, QGridLayout
from PyQt5.QtCore import QTimer
from PyQt5.QtGui import QImage, QPixmap
from CarObject import car
from pose_estimation_with_openvino import create_model, model_predict
import traceback

class Window(QWidget):

    def __init__(self):
        super().__init__()

        # 准备初始地图
        self.map = np.ones([700, 500, 3]).astype('uint8') * 0

        # 绘制五车道
        self.map[:, 0:100, :] = (0, 255, 0)
        self.map[:, 400:-1, :] = (0, 255, 0)
        for i in [100, 160, 220, 280, 340, 400]:
            self.map[:, i-5:i+5, :] = (255, 255, 255)

        self.up_key_points = [9,9]# [0,0]
        self.down_key_points = [10,10]#[5,6]

        self.car = car() # 从CarObject 导入 Car
        self.direction = 0 # 判断角度
        self.game_status = 0 # 游戏状态 0 等待开始 1 进行

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
        # self.Game_Box.setScaledContents(True)

        self.Pred_Box = QLabel()  # 定义显示视频的Label
        self.Pred_Box.setFixedSize(500, 500)
        grid.addWidget(self.Pred_Box, 0, 20, 20, 20)
        # self.Pred_Box.setScaledContents(True)

        self.setWindowTitle('OpenVINO Cars')
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
        try:
            self.model_infor = create_model()
        except:
            # for deploy debug only
            print("++++++run file path")
            print(__file__)
            dir_name = os.path.dirname(__file__)
            print(dir_name)
            print(os.path.abspath("./human-pose-estimation-0001/FP16-INT8/human-pose-estimation-0001.xml"))
            print(os.path.exists("./human-pose-estimation-0001/FP16-INT8/human-pose-estimation-0001.xml"))
            print("++++++run content")
            for root, dirs, files in os.walk(dir_name, topdown=False):
                for name in files:
                    print(os.path.join(root, name))
            print("++++++wrong information")
            self.model_infor = {}
            traceback.print_exc()

    def inferModel(self):
        # read pic from camera
        _, img = self.camera.read()  # 从视频流中读取
        img = cv2.flip(img, 1) # 摄像头画面反转
        img2 = cv2.resize(img, (500, 500))  # 把读到的帧的大小重新设置为 640x480
        showPic = QImage(img2, img2.shape[1], img2.shape[0], QImage.Format_BGR888)
        self.Pred_Box.setPixmap(QPixmap.fromImage(showPic))

        try:
            keypoints = model_predict(img, self.model_infor)[0]

            top_y = (keypoints[self.up_key_points[0]][1] + keypoints[self.up_key_points[1]][1]) / 2
            top_x = (keypoints[self.up_key_points[0]][0] + keypoints[self.up_key_points[1]][0]) / 2
            bottom_y = (keypoints[self.down_key_points[0]][1] + keypoints[self.down_key_points[1]][1]) / 2
            bottom_x = (keypoints[self.down_key_points[0]][0] + keypoints[self.down_key_points[1]][0]) / 2

            if self.game_status == 0 or self.game_status == 2:
                if top_x!=0 and top_y!=0 and bottom_x!=0 and bottom_y!=0:
                    if abs(top_x-bottom_x) + abs(top_y-bottom_y) < 50:
                        # 游戏启动，更新画面状态
                        self.game_status = 1
                        self.car.__init__()
            elif self.game_status == 1:
                if ((top_x - bottom_x) ** 2 + (top_y - bottom_y) ** 2) != 0:
                    self.direction = math.acos((top_y - bottom_y) / ((top_x - bottom_x) ** 2 + (top_y - bottom_y) ** 2) ** (1 / 2)) - math.pi/2


            # 模糊
            # img = cv2.resize(img, (40, 40))
            # img = cv2.resize(img, (640, 640), interpolation=cv2.INTER_NEAREST)

            img[int(top_y)-10:int(top_y)+10,int(top_x)-10:int(top_x)+10] = [0, 0, 255]
            img[int(bottom_y) - 10:int(bottom_y) + 10, int(bottom_x) - 10:int(bottom_x) + 10] = [0, 0, 255]
            showPic = QImage(img, img.shape[1], img.shape[0], QImage.Format_BGR888)
            self.Pred_Box.setPixmap(QPixmap.fromImage(showPic))

        except:
            print('infer error')


    def updata_frame(self):
        # 推理和更新数据
        self.inferModel()
        if self.game_status == 1:
            self.car.update(self.direction)

        # 更新画面
        current_map = copy.deepcopy(self.map) # 复制底图
        current_map = self.car.draw(current_map)
        current_map = current_map[100:600,:,:] # 裁剪底图

        # 更新画面文字
        self.addText(current_map)

        showPic = QImage(current_map, current_map.shape[1], current_map.shape[0], QImage.Format_BGR888)
        self.Game_Box.setPixmap(QPixmap.fromImage(showPic))

        # 更新框体展示状态
        if self.game_status == 1:
            if self.car.is_collision == 1:
                self.game_status = 2 # 游戏结束的评分页面

    def addText(self,img):
        if self.game_status == 0:
            img[75:350,50:450] = (134, 185, 222)
            cv2.putText(img, 'OpenVINO Cars', (60, 150), cv2.FONT_HERSHEY_SIMPLEX, 1.5, (0, 0, 0), 5)
            cv2.putText(img, 'Hold the virtual steering wheel with both hands', (60, 180), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 0), 1)
            cv2.putText(img, 'in the picture to control the car. The game',(60, 210), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 0), 1)
            cv2.putText(img, 'ends when the car crashes. Try to stick to it',(60, 240), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 0), 1)
            cv2.putText(img, 'for a longer time!',(60, 270), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 0), 1)
            cv2.putText(img, 'Move your wrist so that two red dots cross to', (60, 310), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 0), 1)
            cv2.putText(img, 'start!', (60, 340), cv2.FONT_HERSHEY_SIMPLEX, 0.5,(0, 0, 0), 1)
        elif self.game_status == 2:
            img[75:350,50:450] = (134, 185, 222)
            cv2.putText(img, 'OpenVINO Cars', (60, 150), cv2.FONT_HERSHEY_SIMPLEX, 1.5, (0, 0, 0), 5)
            cv2.putText(img, 'YOUR SCORE', (180, 200), cv2.FONT_HERSHEY_SIMPLEX, 0.75, (0, 0, 255), 2)
            cv2.putText(img, self.car.show_time, (210, 240), cv2.FONT_HERSHEY_SIMPLEX, 0.75, (0, 255, 255), 2)
            cv2.putText(img, 'Move your wrist so that two red dots cross to', (60, 310), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 0), 1)
            cv2.putText(img, 'start!', (60, 340), cv2.FONT_HERSHEY_SIMPLEX, 0.5,(0, 0, 0), 1)

if __name__ == '__main__':
    app = QApplication(sys.argv)
    ex = Window()
    sys.exit(app.exec_())