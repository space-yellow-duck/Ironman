# img.npy 파일 만들기
import cv2, numpy as np
img = cv2.imread("./img/left_side_standing.png",cv2.IMREAD_UNCHANGED)
np.save("squat.npy", img)



