import cv2
import json


def get_img_and_resize(config_dict, key, width=1600, height=900):
    fig_path, x, y, w, h = config_dict[key]
    w = int(w * height) if w < 1 else w
    h = int(h * height) if h < 1 else h
    img = cv2.imread(fig_path)
    img = cv2.resize(img, (w, h))
    return img


def paste_image(img1, img2, position_percent):
    # 获取img1和img2的尺寸
    height1, width1, _ = img1.shape
    height2, width2, _ = img2.shape
    # 计算粘贴位置的中心点
    center_x = int(width1 * position_percent[0])
    center_y = int(height1 * position_percent[1])
    # 计算粘贴的起始位置
    x_offset = max(0, center_x - width2 // 2)
    y_offset = max(0, center_y - height2 // 2)
    # 根据实际粘贴位置调整截取的第二张图片的区域
    src_x = max(0, width2 // 2 - (center_x - x_offset))
    src_y = max(0, height2 // 2 - (center_y - y_offset))
    # 计算实际粘贴的区域大小
    paste_width = min(width2, width1 - x_offset) - src_x
    paste_height = min(height2, height1 - y_offset) - src_y

    if paste_width > 0 and paste_height > 0:  # 确保有内容可以粘贴
        # 只粘贴部分画面到img1
        img1[y_offset:y_offset + paste_height, x_offset:x_offset + paste_width] = \
            img2[src_y:src_y + paste_height, src_x:src_x + paste_width]
    return img1


class FloatPrecisionEncoder(json.JSONEncoder):
    def __init__(self, *, precision: int):
        super().__init__()
        self.precision = precision

    def encode(self, o):
        return super().encode(self._format_floats(o))

    def _format_floats(self, o):
        if isinstance(o, float):
            return round(o, self.precision)
        elif isinstance(o, dict):
            return {k: self._format_floats(v) for k, v in o.items()}
        elif isinstance(o, (list, tuple)):
            return [self._format_floats(x) for x in o]
        else:
            return o