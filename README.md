# 🏋️‍♂️ Ironman

> **실시간 운동자세 교정 및 운동 루틴 생성 AI 홈트레이너 서비스**

---

## 📆 프로젝트 개요

- **기간:** 2025.07.22 ~ 2025.08.12  
- **형태:** 팀 프로젝트  
- **목표:**  
  - 실시간 운동 자세 분석 및 교정 피드백 제공  
  - 사용자의 목표/운동 수준에 맞는 운동 루틴 자동 생성  
  - 생성된 루틴의 자동 등록 및 관리 기능 제공

---

## 🛠 기술 스택

### Backend
- Java, Spring Boot  
- Python, Flask  
- JPA  
- WebSocket / Socket.IO  

### Frontend
- React  
- HTML, CSS, JavaScript  
- react-webcam  

### API,Library
- OpenAI API  
- MediaPipe Pose  
- OpenCV
- Google Cloud Platform TTS API

### Database
- MySQL  



---

## ✨ 주요 기능

- ✅ **운동 자세 분석 및 교정 피드백**
  - 관절 좌표 추출 및 각도 계산
  - 잘못된 자세 판단 및 실시간 피드백 제공
  - 좋은 자세/나쁜 자세 카운트

- 🔊 **음성 피드백 기능**
  - Google TTS를 활용한 코칭 음성 안내

- 🤖 **운동 루틴 생성 챗봇**
  - OpenAI 기반 대화형 루틴 생성
  - 사용자 니즈 파악 및 응답 제어
  - Google Cloud Platform TTS API
  - 자연어 → JSON 파싱 자동화

- 🗂 **운동 루틴 관리**
  - 루틴 등록/수정 기능
  

---

## 👤 담당 역할

### ✔ 운동자세 피드백 모듈
- MediaPipe Pose를 이용한 **관절 좌표 추출**
- 좌표 기반 **관절 각도 계산 및 판단 로직 구현**
- React 환경에서 **Webcam 기능 구현**
- **WebSocket 서버 구성 및 실시간 통신 처리**
- OpenCV를 활용한:
  - 각도 시각화
  - 자세 시각화 On/Off 기능
- 올바른 자세 / 잘못된 자세 **카운팅 로직 구현**

### ✔ 음성 피드백
- Google Cloud TTS API 연동
- 실시간 자세 교정 내용 음성 출력

### ✔ 루틴 생성 챗봇
- 대화 흐름 제어 및 상태 관리
- 프롬프트 엔지니어링 설계
- 사용자 응답 포맷 제어

### ✔ 루틴 자동 등록
- 자연어 응답을 **JSON 구조로 파싱**
- 자동 저장 및 매핑 로직 구현

---

## 🚧 어려웠던 점과 해결 방법

### 1) 챗봇 JSON 파싱 문제
- 문제:
  - OpenAI 응답 형식이 **일정한 JSON 형태로 나오지 않음**
- 해결:
  - 프롬프트 단계에서 **응답 포맷 강제**
  - 먼저 고정된 자연어 양식으로 응답하도록 제어
  - 이후 해당 자연어를 **JSON으로 2차 파싱**하도록 설계

### 2) 대화 흐름 관리 (LangChain 미사용 환경)
- 문제:
  - LangChain 미사용으로 대화 이력을 직접 관리해야 함
  - deque 자료구조 사용이 처음이라 제어 난이도 높음
- 해결:
  - deque를 이용해 대화 최대 길이 설정 및 관리
  - system prompt를 별도 보관 후 재조합하는 방식 설계
  - 안정적인 대화 컨텍스트 관리 구조 직접 구현

---

## 🧭 시스템 구성도 (예시)
<img width="734" height="412" alt="image" src="https://github.com/user-attachments/assets/e7fee059-e8f2-44e8-92bc-92a63ac041f4" />


- Frontend (React, react-webcam)  
- Backend (Spring Boot, Flask)  
- AI Engine (OpenAI + MediaPipe)  
- DB (MySQL)  
- 
---

## ERD

<img width="920" height="702" alt="image" src="https://github.com/user-attachments/assets/00752d1f-60f6-4d31-979f-956815bd229b" />


## ⚙ 실행 방법 (예시)

```bash
git clone https://github.com/your-id/ironman.git
cd ironman
```

> 구체 실행 방법

---

## 📌 향후 개선 계획
- 사용자별 맞춤 루틴 추천 고도화
- 자세 분석 정확도 향상 (ML 모델 적용 검토)
- 모바일 대응 UI/UX 개선
- WebRTC 기반 성능 최적화

---

## 📎 관련 링크
- 시연 영상: (있다면 입력)
