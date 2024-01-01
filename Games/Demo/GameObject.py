import cv2
import math
import time
import random
import numpy as np

class GameObject(object):
    def __init__(self):
        self.x = 100
        self.y = 100

        self.score = 0

    def update(self, keypoints): # F 代表玩家在杠杆方向的力
        self.x = keypoints[9][0]
        self.y = keypoints[9][1]

    def get_game_state(self):
        game_status = False

        if 0: # self.x > 250:
            game_status = True

        return game_status, self.score

    def draw_canvas(self):
        # draw balance
        img = np.ones([500, 500, 3]).astype('uint8') * 255
        cv2.circle(img, (int(self.x), int(self.y)), 5, (255, 0, 0), 3) # draw circle
        return img
