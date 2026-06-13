import cv2
import numpy as np
from numpy.lib.stride_tricks import as_strided
from openvino.runtime import Core

from decoder import OpenPoseDecoder

decoder = OpenPoseDecoder()

# 2D pooling in numpy (from: https://stackoverflow.com/a/54966908/1624463)
def pool2d(A, kernel_size, stride, padding, pool_mode="max"):
    """
    2D Pooling

    Parameters:
        A: input 2D array
        kernel_size: int, the size of the window
        stride: int, the stride of the window
        padding: int, implicit zero paddings on both sides of the input
        pool_mode: string, 'max' or 'avg'
    """
    # Padding
    A = np.pad(A, padding, mode="constant")

    # Window view of A
    output_shape = (
        (A.shape[0] - kernel_size) // stride + 1,
        (A.shape[1] - kernel_size) // stride + 1,
    )
    kernel_size = (kernel_size, kernel_size)
    A_w = as_strided(
        A,
        shape=output_shape + kernel_size,
        strides=(stride * A.strides[0], stride * A.strides[1]) + A.strides
    )
    A_w = A_w.reshape(-1, *kernel_size)

    # Return the result of pooling.
    if pool_mode == "max":
        return A_w.max(axis=(1, 2)).reshape(output_shape)
    elif pool_mode == "avg":
        return A_w.mean(axis=(1, 2)).reshape(output_shape)


# non maximum suppression
def heatmap_nms(heatmaps, pooled_heatmaps):
    return heatmaps * (heatmaps == pooled_heatmaps)


# Get poses from results.
def process_results(img, pafs, heatmaps, compiled_model):
    # This processing comes from
    # https://github.com/openvinotoolkit/open_model_zoo/blob/master/demos/common/python/models/open_pose.py
    pooled_heatmaps = np.array(
        [[pool2d(h, kernel_size=3, stride=1, padding=1, pool_mode="max") for h in heatmaps[0]]]
    )
    nms_heatmaps = heatmap_nms(heatmaps, pooled_heatmaps)

    # Decode poses.
    poses, scores = decoder(heatmaps, nms_heatmaps, pafs)
    output_shape = list(compiled_model.output(index=0).partial_shape)
    output_scale = img.shape[1] / output_shape[3].get_length(), img.shape[0] / output_shape[2].get_length()
    # Multiply coordinates by a scaling factor.
    poses[:, :, :2] *= output_scale
    return poses, scores

colors = ((255, 0, 0), (255, 0, 255), (170, 0, 255), (255, 0, 85), (255, 0, 170), (85, 255, 0),
          (255, 170, 0), (0, 255, 0), (255, 255, 0), (0, 255, 85), (170, 255, 0), (0, 85, 255),
          (0, 255, 170), (0, 0, 255), (0, 255, 255), (85, 0, 255), (0, 170, 255))

default_skeleton = ((15, 13), (13, 11), (16, 14), (14, 12), (11, 12), (5, 11), (6, 12), (5, 6), (5, 7),
                    (6, 8), (7, 9), (8, 10), (1, 2), (0, 1), (0, 2), (1, 3), (2, 4), (3, 5), (4, 6))


def draw_poses(img, poses, point_score_threshold, skeleton=default_skeleton):
    if poses.size == 0:
        return img

    img_limbs = np.copy(img)
    for pose in poses:
        points = pose[:, :2].astype(np.int32)
        points_scores = pose[:, 2]
        # Draw joints.
        for i, (p, v) in enumerate(zip(points, points_scores)):
            if v > point_score_threshold:
                cv2.circle(img, tuple(p), 1, colors[i], 2)
        # Draw limbs.
        for i, j in skeleton:
            if points_scores[i] > point_score_threshold and points_scores[j] > point_score_threshold:
                cv2.line(img_limbs, tuple(points[i]), tuple(points[j]), color=colors[j], thickness=4)
    cv2.addWeighted(img, 0.4, img_limbs, 0.6, 0, dst=img)
    return img

def create_model(model_path = "./human-pose-estimation-0001/FP16-INT8/human-pose-estimation-0001.xml"):
    # Initialize OpenVINO Runtime
    ie_core = Core()
    model = ie_core.read_model(model_path)
    # Let the AUTO device decide where to load the model (you can use CPU, GPU or MYRIAD as well).
    compiled_model = ie_core.compile_model(model=model, device_name="CPU", config={"PERFORMANCE_HINT": "LATENCY"})

    # Get the input and output names of nodes.
    input_layer = compiled_model.input(0)

    # Get the input size.
    height, width = list(input_layer.shape)[2:]

    pafs_output_key = compiled_model.output("Mconv7_stage2_L1")
    heatmaps_output_key = compiled_model.output("Mconv7_stage2_L2")

    return {"height":height, "width":width, "compiled_model":compiled_model, "pafs_output_key":pafs_output_key, "heatmaps_output_key":heatmaps_output_key}


def model_predict(frame, model_infor):
    height = model_infor["height"]
    width = model_infor["width"]
    pafs_output_key = model_infor["pafs_output_key"]
    heatmaps_output_key = model_infor["heatmaps_output_key"]
    compiled_model = model_infor["compiled_model"]

    # If the frame is larger than full HD, reduce size to improve the performance.
    scale = 1280 / max(frame.shape)
    if scale < 1:
        frame = cv2.resize(frame, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA)

    # Resize the image and change dims to fit neural network input.
    # (see https://github.com/openvinotoolkit/open_model_zoo/tree/master/models/intel/human-pose-estimation-0001)
    input_img = cv2.resize(frame, (width, height), interpolation=cv2.INTER_AREA)
    # Create a batch of images (size = 1).
    input_img = input_img.transpose((2,0,1))[np.newaxis, ...]

    # Get results.
    results = compiled_model([input_img])

    pafs = results[pafs_output_key]
    heatmaps = results[heatmaps_output_key]
    # Get poses from network results.
    poses, scores = process_results(frame, pafs, heatmaps, compiled_model)
    return poses


if __name__ == '__main__':
    model_infor = create_model()
    frame = cv2.imread('example.jpg')
    poses = model_predict(frame, model_infor)
    print(poses)
