// src/pages/PostureAnalysisPage.jsx
import React, { useEffect, useState, useRef, useContext } from 'react';
import '../styles/PostureAnalysis.css';
import StatBox from '../components/posture/StatBox';
import FeedbackToggle from '../components/posture/FeedbackToggle';
import axios from 'axios';
import { useNavigate, useLocation } from 'react-router-dom';
import TrainingCamTest from '../components/TrainingCamTest';
import PageWrapper from '../layouts/PageWrapper';
import { CountContext } from '../context/CountContext';
import { AuthContext } from '../context/AuthContext';
import { AnimatePresence, motion } from 'framer-motion';
import TrainingCam from '../components/TrainingCam';
/* ---------------------- utils ---------------------- */
const formatTime = (sec) => {
  const m = Math.floor((sec ?? 0) / 60);
  const s = (sec ?? 0) % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
};


const calcTotalTime = (routine) =>
  (routine?.exercises ?? []).reduce((acc, cur) => {
    const ex = (cur.exerciseTime ?? 0) * (cur.sets ?? 1);
    const br = (cur.breaktime ?? 0)   * (cur.sets ?? 1);
    return acc + ex + br;
  }, 0);

const buildExerciseLogs = (routine, exerciseResults, durationSeconds) =>
  (routine?.exercises ?? []).map((ex) => {
    const s = exerciseResults[ex.exerciseId] || {};
    return {
      exerciseId: ex.exerciseId,
      duration: ex.exerciseTime ?? 0,
      endTime: durationSeconds,
      goodCount: s.goodCount || 0,
      badCount:  s.badCount  || 0,
      sets: ex.sets,
      reps: ex.reps,
      breaktime: ex.breaktime,
    };
  });

/** 어떤 응답이 와도 exerciseId -> singleExerciseLogId 매핑 생성 */
const mapLogIds = (resp, reqExerciseLogs) => {
  // { logs: [{exerciseId, singleExerciseLogId}] }
  if (resp && Array.isArray(resp.logs)) {
    const m = {};
    resp.logs.forEach(it => {
      if (it && it.exerciseId != null && it.singleExerciseLogId != null) {
        m[it.exerciseId] = it.singleExerciseLogId;
      }
    });
    if (Object.keys(m).length) return m;
  }
  // [123,124,...]
  if (Array.isArray(resp)) {
    const m = {};
    (reqExerciseLogs || []).forEach((ex, idx) => {
      if (resp[idx] != null && ex?.exerciseId != null) {
        m[ex.exerciseId] = resp[idx];
      }
    });
    if (Object.keys(m).length) return m;
  }
  // { ids: [...] }
  if (resp && Array.isArray(resp.ids)) {
    const m = {};
    (reqExerciseLogs || []).forEach((ex, idx) => {
      if (resp.ids[idx] != null && ex?.exerciseId != null) {
        m[ex.exerciseId] = resp.ids[idx];
      }
    });
    if (Object.keys(m).length) return m;
  }
  return {};
};

// 더미 계산식: 세션 지표 → 결과 화면용
const estimateCalories = (good, bad, totalSeconds) => {
  // (총카운트 * 0.9kcal) + (시간(분) * 3.5kcal), 최소 50
  const total = good + bad;
  const timeMin = Math.max(1, Math.round(totalSeconds / 60));
  return Math.max(50, Math.round(total * 0.9 + timeMin * 3.5));
};
const buildRadarDummy = (good, bad) => {
  const total = Math.max(1, good + bad);
  const pct = (v) => Math.min(100, Math.round((v / total) * 100));
  return [
    { subject: '상체 근력', value: pct(good * 0.6 + bad * 0.3) },
    { subject: '하체 근력', value: pct(good * 0.4 + bad * 0.4) },
    { subject: '유연성',   value: pct(good * 0.3 + bad * 0.2) },
    { subject: '체력 종합', value: pct(good * 0.5 + bad * 0.5) },
    { subject: '체력균형', value: pct(good * 0.35 + bad * 0.25) },
    { subject: '근지구력', value: Math.min(100, good * 2 + 30) },
  ];
};

const PostureAnalysisPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const routine = location.state?.routine;

  const { user } = useContext(AuthContext);

  const [isFeedbackOn, setIsFeedbackOn] = useState(true);
  const [exerciseList, setExerciseList] = useState([]);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [viewKnee, setViewKnee] = useState(false);
  const [viewLegHip, setViewLegHip] = useState(false);
  const [viewUpper, setViewUpper] = useState(false);
  const [viewShoulder, setViewShoulder] = useState(false);
  const [capturedList, setCapturedList] = useState([]);   // {img, issue, type, exerciseId}
  const [selectedCapture, setSelectedCapture] = useState(null);
  const [goodCount, setGoodCount] = useState(0);
  const [badCount, setBadCount] = useState(0);
  const [isStarted, setIsStarted] = useState(false);
  const [startAt, setStartAt] = useState(null);
  const [remainingTime, setRemainingTime] = useState(0);
  const [liveDots, setLiveDots] = useState([]);
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0); 
  const currentExercise = routine?.exercises?.[currentExerciseIndex] ?? null;
  const [doneOverall, setDoneOverall] = useState(0);     // 전체 진행 수
  const [doneInExercise, setDoneInExercise] = useState(0); // 현재 운동에서의 진행 수
  const nextExercise   = routine?.exercises?.[currentExerciseIndex + 1] ?? null;
  const currentTarget = ((currentExercise?.reps ?? 0) * (currentExercise?.sets ?? 1)) || 0;
  const [history, setHistory] = useState([]);        // 끝난(또는 지나간) 운동들
  const carouselRef = useRef(null);
  const totalReps = routine?.exercises?.reduce (
  (acc, cur) => acc + ((cur.reps ?? 0) * (cur.sets ?? 1)),
    0
    ) ?? 0;

  const [exerciseResults, setExerciseResults] = useState({}); // { [exerciseId]: {goodCount, badCount} }const totalReps = routine?.exercises?.reduce((acc, cur) => acc + ((cur.reps ?? 0) * (cur.sets ?? 1)), 0) ?? 0;
  const [poseHistory, setPoseHistory] = useState([]);

  const [reportImg, setReportImg] = useState('');
  const hasSavedRef = useRef(false);

  // ✅ 추가: 종료 안내 오버레이 & 카운트다운
  const [showEndOverlay, setShowEndOverlay] = useState(false);
  const [countdown, setCountdown] = useState(10);
  const resultPayloadRef = useRef(null); // workoutresult로 넘길 state 보관

  const toggleFeedback = () => setIsFeedbackOn(v => !v);

  useEffect(() => { if (routine) setRemainingTime(calcTotalTime(routine)); }, [routine]);

  // 카운트다운
  useEffect(() => {
    if (!isStarted || remainingTime <= 0) return;
    const t = setInterval(() => setRemainingTime(prev => (prev <= 1 ? 0 : prev - 1)), 1000);
    return () => clearInterval(t);
  }, [isStarted, remainingTime]);

  const currentExerciseId = currentExercise?.exerciseId;

  const canCountNow = () =>
  isStarted && !hasSavedRef.current && currentExerciseId && doneOverall < totalReps;


   // ----- 진행 목표 계산들 아래에 둡니다 -----
const incOne = () => {
  setDoneOverall(prev => (prev >= totalReps ? prev : prev + 1));
  setDoneInExercise(prev => {
    const next = currentTarget > 0 ? Math.min(prev + 1, currentTarget) : prev;
    return next;
  });
};

  const onRepCounted = () => {
    if (!canCountNow()) return;
    setExerciseResults(prev => ({
      ...prev,
      [currentExerciseId]: {
        goodCount: prev[currentExerciseId]?.goodCount || 0,
        badCount:  prev[currentExerciseId]?.badCount  || 0,
      }
    }));
    incOne();
  };

  

  const onGoodPosture = () => {
  if (!canCountNow()) return;
  setExerciseResults(prev => ({
    ...prev,
    [currentExerciseId]: {
      goodCount: (prev[currentExerciseId]?.goodCount || 0) + 1,
      badCount:  (prev[currentExerciseId]?.badCount  || 0),
    }
  }));
  setGoodCount(v => v + 1);
  setPoseHistory(prev => [...prev, { type: 'good', id: Date.now() }]);
  incOne();
};

const onBadPosture = () => {
  if (!canCountNow()) return;
  setExerciseResults(prev => ({
    ...prev,
    [currentExerciseId]: {
      goodCount: (prev[currentExerciseId]?.goodCount || 0),
      badCount:  (prev[currentExerciseId]?.badCount  || 0) + 1,
    }
  }));
  setBadCount(v => v + 1);
  setPoseHistory(prev => [...prev, { type: 'bad', id: Date.now() }]);
  incOne();
};


  // 총/현재 진행 감시
useEffect(() => {
  if (!isStarted) return;

  // (A) 현재 운동 완료 → 다음 운동으로
  if (currentTarget > 0 && doneInExercise >= currentTarget) {
    const nextIndex = (currentExerciseIndex ?? 0) + 1;
    const totalExercises = routine?.exercises?.length ?? 0;

    if (nextIndex < totalExercises) {
        if (currentExercise) {
      setHistory((h) => [...h, currentExercise]); }
      setCurrentExerciseIndex(nextIndex);
      setDoneInExercise(0);
      // 필요하면 안내 음성
      try { getSpeech?.(`${routine?.exercises?.[nextIndex]?.exerciseName} 시작`); } catch {}
    } else {
      // 마지막 운동까지 끝났다면 저장 트리거
      setIsStarted(false);
      setRemainingTime(0);
      handleVideoEnd();
    }
  }

  // (B) 전체 목표 달성 → 저장(백업 조건)
  if (totalReps !== 0 && doneOverall >= totalReps && isStarted) {
    const videoEl = document.querySelector('video');
    if (videoEl && !videoEl.paused) videoEl.pause();
    setIsStarted(false);
    setRemainingTime(0);
    handleVideoEnd();
  }
}, [
  doneOverall,          // 전체 진행 수
  isStarted,
  currentTarget,        // 현재 운동 목표(세트*횟수)
  doneInExercise,       // 현재 운동에서의 진행 수
  currentExerciseIndex,
  routine
]);

useEffect(() => {
  const el = carouselRef.current;
  if (!el) return;
  // 오른쪽 끝으로 부드럽게 이동
  el.scrollTo({ left: el.scrollWidth, behavior: 'smooth' });
}, [history, currentExerciseIndex]);

  const handleVideoEnd = async () => {
    if (hasSavedRef.current) return;

    if (doneOverall < totalReps) {
      const videoEl = document.querySelector("video");
      if (videoEl) videoEl.play();
      return;
    }

    hasSavedRef.current = true;
    setIsStarted(false);

    const durationSeconds = startAt ? Math.round((Date.now() - startAt) / 1000) : 0;
    const exerciseLogs = buildExerciseLogs(routine, exerciseResults, durationSeconds);
    const payload = { email: user.email, exerciseLogs };

    // 1) 결과 저장
    let idByExercise = {};
    try {
      const { data } = await axios.post(
        'http://localhost:329/web/api/exercise/result',
        payload,
        { withCredentials: true }
      );
      idByExercise = mapLogIds(data, exerciseLogs);
    } catch (err) {
      console.error('❌ 운동 결과 저장 실패:', err?.response?.data ?? err);
      alert('운동 결과 저장에 실패했습니다.');
      navigate('/main');
      return;
    }

    // 2) 캡처 업로드(선택)
    try {
      const jobs = (capturedList ?? [])
        .filter(e => e?.img && e.img.length > 100)
        .map(entry => {
          const base64 = entry.img.includes(',') ? entry.img.split(',')[1] : entry.img;
          const logId = entry.exerciseId != null ? idByExercise[entry.exerciseId] : undefined;
          if (logId == null) return Promise.resolve();
          const body = {
            singleExerciseLogId: logId,
            detectedIssue: entry.issue ?? '0',
            feedbackImg: base64,
            postureFeedbackcol: entry.type ?? '자동 캡처',
          };
          return axios.post('http://localhost:329/web/api/posture/upload', body, { withCredentials: true });
        });

      await Promise.all(jobs);
    } catch (error) {
      console.error('❌ 캡처 업로드 실패:', error?.response?.data ?? error);
    }

    // 3) 결과 요약(프론트 상태) → WorkoutResultPage로 전달할 payload만 준비
    const calories = estimateCalories(goodCount, badCount, durationSeconds);
    const radarData = buildRadarDummy(goodCount, badCount);
    const sessionSummary = {
   email: user.email,
   doneReps: doneOverall,
   totalReps,
   goodCount,
   badCount,
   totalSeconds: durationSeconds,
   exerciseLogs,
   routineMeta: {
     routineId: routine?.routineId ?? null,
     routineName: routine?.name ?? '오늘의 루틴',
   },
 };

    // 이동 payload를 ref에 보관하고, 안내 오버레이 오픈 + 카운트다운 시작
    resultPayloadRef.current = {
      from: '/postureanalysis',
      radarData,
      caloriesBurned: calories,
      mistakeCount: badCount,
      session: sessionSummary,
    };
    setCountdown(10);
    setShowEndOverlay(true);
  };

  // ✅ 안내 오버레이 카운트다운 타이머
  useEffect(() => {
    if (!showEndOverlay) return;
    if (countdown <= 0) {
      // 자동 이동
      if (resultPayloadRef.current) {
        navigate('/workoutresult', { state: resultPayloadRef.current });
      } else {
        navigate('/main');
      }
      return;
    }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [showEndOverlay, countdown, navigate]);

  const goResultNow = () => {
    if (resultPayloadRef.current) {
      setShowEndOverlay(false);
      navigate('/workoutresult', { state: resultPayloadRef.current });
    }
  };
  const goHomeNow = () => {
    setShowEndOverlay(false);
    navigate('/main');
  };

  // 간단한 인라인 스타일(새 CSS 파일 수정 없이 최소 변경)
  const overlayStyles = {
    overlay: {
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 10000
    },
    card: {
      width: 'min(480px, 92vw)', background: '#101010', color: '#eaeaea',
      border: '1px solid #1f1f1f', borderRadius: 16, padding: 20,
      boxShadow: '0 24px 60px rgba(0,0,0,0.45)', textAlign: 'center'
    },
    title: { margin: '0 0 8px', fontSize: 18, fontWeight: 800 },
    desc: { margin: '0 0 14px', color: '#bbbbbb', fontSize: 14 },
    ctaRow: { display: 'flex', gap: 8, justifyContent: 'center', marginTop: 8, flexWrap: 'wrap' },
    btn: {
      background: '#161616', color: '#fff', border: '1px solid #2b2b2b',
      padding: '10px 14px', borderRadius: 12, cursor: 'pointer', fontWeight: 800
    },
    primary: {
      background: '#222', color: '#000', border: '1px solid #2b2b2b',
      position: 'relative', overflow: 'hidden'
    },
    progressWrap: {
      display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center', marginTop: 6
    },
    progressBar: {
      width: '100%', height: 8, background: '#171717', borderRadius: 999, overflow: 'hidden',
      border: '1px solid #2b2b2b'
    },
    progressFill: (pct) => ({
      width: `${pct}%`, height: '100%',
      background: 'linear-gradient(90deg, #FBD157, #ffe08c)'
    }),
    countText: { fontSize: 12, color: '#aaa' }
  };

  return (
    <CountContext.Provider value={{
      goodCount, setGoodCount,
      badCount, setBadCount,
      setReportImg,
      setCapturedList
    }}>
      <PageWrapper>
  <div className="posture-container">
    {/* 좌측 패널 */}
    <div className="posture-left">
      <header className="posture-header">
        <img className="logo" src="./images/ironman_logo4.png" alt="로고"
             onClick={() => navigate('/main')} style={{ cursor: 'pointer' }} />
        <h2>운동 및 자세분석</h2>
        <div className="settings-icon" onClick={() => navigate('/settings')} style={{ cursor: 'pointer' }}>⚙️</div>
      </header>

      <div className="posture-stats">
        <StatBox label="총 횟수" count={goodCount + badCount} />
        <StatBox label="좋은 자세" count={goodCount} />
        <StatBox label="나쁜 자세" count={badCount} />
      </div>

      <FeedbackToggle isOn={isFeedbackOn} onToggle={toggleFeedback} />

      {isStarted && (
        <div className="realtime-pills-card">
          <div className="realtime-row">
            {poseHistory.map((p, i) => (
              <span key={p.id ?? i} className={`pill-seg ${p.type}`} />
            ))}
          </div>
        </div>
      )}

      <div className="exercise-buttons">
        {exerciseList.map((exercise, idx) => (
          <button
            key={idx}
            className={`exercise-btn ${selectedVideo === exercise.videoUrl ? 'active' : ''}`}
            onClick={() => setSelectedVideo(exercise.videoUrl)}
          >
            {exercise.name}
          </button>
        ))}
      </div>

      <div className="posture-stats">
        <button className="stat-box" onClick={() => setViewKnee(v => !v)} style={viewKnee ? { backgroundColor: 'gray' } : undefined}>무릎 발끝 수직선 체크</button>
        <button className="stat-box" onClick={() => setViewLegHip(v => !v)} style={viewLegHip ? { backgroundColor: 'gray' } : undefined}>무릎 허리 각도보기</button>
        <button className="stat-box" onClick={() => setViewShoulder(v => !v)} style={viewShoulder ? { backgroundColor: 'gray' } : undefined}>어깨 무게 중심</button>
        <button className="stat-box" onClick={() => setViewUpper(v => !v)} style={viewUpper ? { backgroundColor: 'gray' } : undefined}>상체 기울기</button>
      </div>

      {selectedCapture && (
        <div className="capture-preview">
          <h4>📷 선택한 캡처 미리보기</h4>
          <img src={selectedCapture} alt="선택된 캡처" className="preview-img" />
          <button onClick={() => setSelectedCapture(null)}>닫기</button>
        </div>
      )}

      <div className="capture-thumbnails">
        {(capturedList ?? []).map((entry, idx) => (
          <img
            key={idx}
            src={entry.img}
            alt={`캡처 ${idx + 1}`}
            className="thumbnail-img"
            onClick={() => setSelectedCapture(entry.img)}
          />
        ))}
      </div>
    </div>
    {/* ↑ 여기까지가 좌측, 닫지 마시고 바로 우측 패널 이어서 렌더링 */}

    {/* 우측(영상) 패널 */}
    <div className="posture-right">

               {/* 운동 캐러셀 */}
        <div
          className="exercise-now-next exercise-carousel"
          ref={carouselRef}
          onWheel={(e) => {
            const el = e.currentTarget;
            el.scrollLeft += e.deltaY;
          }}
        >
          <div className="carousel-track">
            {history.map((ex) => (
              <motion.div
                key={`hist-${ex.exerciseId}`}
                className="card"
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
              >
                <div className="label">지난 운동</div>
                <div className="title">{ex.exerciseName ?? ex.name}</div>
                <div className="info">
                  {(ex.sets ?? 0)}세트 × {(ex.reps ?? 0)}회
                </div>
              </motion.div>
            ))}

            <AnimatePresence mode="wait">
              {currentExercise && (
                <motion.div
                  key={`current-${currentExercise.exerciseId}`}
                  className="card active"
                  initial={{ x: 80, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: -80, opacity: 0 }}
                  transition={{ type: 'tween', duration: 0.28 }}
                >
                  <div className="label">지금 운동</div>
                  <div className="title">
                    {currentExercise.exerciseName ?? currentExercise.name}
                  </div>
                  <div className="info">
                    {(currentExercise.sets ?? 0)}세트 × {(currentExercise.reps ?? 0)}회
                    {currentTarget ? ` · 진행 ${doneInExercise}/${currentTarget}` : ''}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <motion.div
              key={`next-${nextExercise?.exerciseId ?? 'none'}`}
              className="card"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
            >
              <div className="label">다음 운동</div>
              <div className="title">
                {nextExercise ? (nextExercise.exerciseName ?? nextExercise.name) : '모든 운동 완료'}
              </div>
              <div className="info">
                {nextExercise ? `${nextExercise.sets ?? 0}세트 × ${nextExercise.reps ?? 0}회` : ''}
              </div>
            </motion.div>
          </div>
        </div>

      <div className="video-container">
     
        <div className="video-wrapper">
          <TrainingCamTest
            isStarted={isStarted}
            viewKnee={viewKnee}
            viewLegHip={viewLegHip}
            onVideoEnd={handleVideoEnd}
            currentExercise={currentExercise}
            onGoodPosture={onGoodPosture}
            onBadPosture={onBadPosture}
            onRepCounted={onRepCounted}
            viewUpper={viewUpper}
            viewShoulder={viewShoulder}
          />

          {/* 영상 상단 HUD */}
          <div className="video-hud">
            <div className="hud-row">

              <div className="progress-mini">
                <div className="mini-head">
                  <span>📊 진행률 ⏱ 남은 시간 </span>
                  <strong>{formatTime(remainingTime)}</strong>
                  <span className="percent">
                    {Math.round(((doneOverall || 0) / (totalReps || 1)) * 100)}%
                  </span>
                </div>
                <div className="mini-bar">
                  <div
                    className="mini-fill"
                    style={{ width: `${((doneOverall || 0) / (totalReps || 1)) * 100}%` }}
                  />
                </div>
                <div className="mini-text">
                  {doneOverall} / {totalReps} 회
                </div>
              </div>
            </div>
          </div>

          {/* 시작 오버레이(영상 위 중앙) */}
          {!isStarted && (
            <div className="start-overlay in-wrapper">
              <button
                className="start-btn"
                onClick={() => {
                  if (routine) setRemainingTime(calcTotalTime(routine));
                  setDoneOverall(0);
                  setDoneInExercise(0);
                  setCurrentExerciseIndex(0);
                  setGoodCount(0);
                  setBadCount(0);
                  setExerciseResults({});
                  setStartAt(Date.now());
                  hasSavedRef.current = false;
                  setIsStarted(true);
                }}
              >
                시작
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
    {/* ↑ 여기서 posture-container 를 닫습니다 */}
  </div>

  {/* 라이브 점 표시 */}
  {isStarted && (
    <div className="live-dots">
      {liveDots.map((d, i) => (
        <span key={d.id ?? i} className={`dot ${d.type}`} />
      ))}
    </div>
  )}

  {/* 종료 안내 오버레이 */}
  {showEndOverlay && (
    <div style={overlayStyles.overlay}>
      <div style={overlayStyles.card}>
        <h3 style={overlayStyles.title}>운동이 종료되었습니다</h3>
        <p style={overlayStyles.desc}>
          <strong>운동결과페이지</strong>로 이동합니다. ({countdown}초 후 자동 이동)
        </p>

        <div style={overlayStyles.progressWrap}>
          <div style={overlayStyles.progressBar}>
            <div style={overlayStyles.progressFill(((10 - countdown) / 10) * 100)} />
          </div>
          <div style={overlayStyles.countText}>자동 이동까지 {countdown}초</div>
        </div>

        <div style={overlayStyles.ctaRow}>
          <button style={overlayStyles.btn} onClick={goHomeNow}>홈으로 가기</button>
          <button style={{ ...overlayStyles.btn, ...overlayStyles.primary }} onClick={goResultNow}>
            운동결과페이지로 가기
          </button>
        </div>
      </div>
    </div>
  )}
</PageWrapper>

    </CountContext.Provider>
  );
  
};

export default PostureAnalysisPage;
