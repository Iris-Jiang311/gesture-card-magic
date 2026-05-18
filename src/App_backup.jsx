import { useEffect, useRef, useState } from "react";
import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";
import { motion } from "framer-motion";
import "./App.css";

export default function App() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const handLandmarkerRef = useRef(null);

  const [gesture, setGesture] = useState("等待识别...");
  const [cardsOpen, setCardsOpen] = useState(false);
  const [fingerPosition, setFingerPosition] = useState({ x: 0, y: 0 });
  const [selectedCard, setSelectedCard] = useState(null);

  const cards = ["Windy", "Firey", "Watery", "Shadow", "Flower"];

  useEffect(() => {
    async function init() {
      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
      );

      handLandmarkerRef.current = await HandLandmarker.createFromOptions(
        vision,
        {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
            delegate: "GPU",
          },
          runningMode: "VIDEO",
          numHands: 1,
        }
      );

      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
      });

      videoRef.current.srcObject = stream;
      videoRef.current.addEventListener("loadeddata", predict);
    }

    function predict() {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      function loop() {
        if (handLandmarkerRef.current && video.readyState >= 2) {
          const results = handLandmarkerRef.current.detectForVideo(
            video,
            performance.now()
          );

          ctx.clearRect(0, 0, canvas.width, canvas.height);

          if (results.landmarks && results.landmarks.length > 0) {
            const hand = results.landmarks[0];

            drawHandPoints(ctx, hand, canvas.width, canvas.height);

            const openPalm = isOpenPalm(hand);
            const pointing = isPointingGesture(hand);
            const fist = !openPalm && !pointing;

            const indexFingerTip = hand[8];

            const videoRect = video.getBoundingClientRect();

            const screenX =
              videoRect.left + (1 - indexFingerTip.x) * videoRect.width;
            const screenY =
              videoRect.top + indexFingerTip.y * videoRect.height;

            setFingerPosition({
              x: screenX,
              y: screenY,
            });

            if (openPalm) {
              setGesture("张开手：卡牌展开");
              setCardsOpen(true);
              setSelectedCard(null);
            } else if (pointing) {
              setGesture("伸出食指：正在选择卡牌");
              setCardsOpen(true);

              const selected = selectCardByFingerX(indexFingerTip.x);
              setSelectedCard(selected);
            } else if (fist) {
              setGesture("握拳/收手：卡牌收回");
              setCardsOpen(false);
              setSelectedCard(null);
            }
          } else {
            setGesture("没有检测到手");
            setSelectedCard(null);
          }
        }

        requestAnimationFrame(loop);
      }

      loop();
    }

    init();
  }, []);

  function isFingerOpen(hand, tipIndex, pipIndex) {
    return hand[tipIndex].y < hand[pipIndex].y;
  }

  function isOpenPalm(hand) {
    const indexOpen = isFingerOpen(hand, 8, 6);
    const middleOpen = isFingerOpen(hand, 12, 10);
    const ringOpen = isFingerOpen(hand, 16, 14);
    const pinkyOpen = isFingerOpen(hand, 20, 18);

    const openCount = [indexOpen, middleOpen, ringOpen, pinkyOpen].filter(
      Boolean
    ).length;

    return openCount >= 3;
  }

  function isPointingGesture(hand) {
    const indexOpen = isFingerOpen(hand, 8, 6);
    const middleOpen = isFingerOpen(hand, 12, 10);
    const ringOpen = isFingerOpen(hand, 16, 14);
    const pinkyOpen = isFingerOpen(hand, 20, 18);

    return indexOpen && !middleOpen && !ringOpen && !pinkyOpen;
  }

  function selectCardByFingerX(fingerX) {
    const mirroredX = 1 - fingerX;

    if (mirroredX < 0.2) return "Windy";
    if (mirroredX < 0.4) return "Firey";
    if (mirroredX < 0.6) return "Watery";
    if (mirroredX < 0.8) return "Shadow";
    return "Flower";
  }

  function drawHandPoints(ctx, hand, width, height) {
    ctx.fillStyle = "white";

    hand.forEach((point) => {
      ctx.beginPath();
      ctx.arc(point.x * width, point.y * height, 5, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  return (
    <div className="page">
      <h1>Gesture Card Demo</h1>
      <p className="subtitle">用食指左右移动选择卡牌</p>

      <div className="cameraArea">
        <video ref={videoRef} autoPlay playsInline muted />
        <canvas ref={canvasRef} />
      </div>

      <div className="gestureBox">{gesture}</div>

      {cardsOpen && (
        <div className="selectedBox">
          {selectedCard ? `当前选中：${selectedCard}` : "伸出食指左右移动选择卡牌"}
        </div>
      )}

      {cardsOpen && (
        <motion.div
          className="fingerCursor"
          animate={{
            x: fingerPosition.x - 15,
            y: fingerPosition.y - 15,
      }}
    transition={{
      type: "spring",
      stiffness: 300,
      damping: 30,
    }}
  />
)}

      <div className="cardArea">
        {cards.map((card, index) => {
          const isSelected = selectedCard === card;

          return (
            <motion.div
              key={card}
              data-card={card}
              className={`card ${isSelected ? "selected" : ""}`}
              animate={{
                x: cardsOpen ? (index - 2) * 120 : 0,
                y: cardsOpen ? 0 : 40,
                rotate: cardsOpen ? (index - 2) * 8 : 0,
                scale: isSelected ? 1.25 : cardsOpen ? 1 : 0.85,
                opacity: cardsOpen ? 1 : 0.45,
              }}
              transition={{ type: "spring", stiffness: 120 }}
            >
              <span>{card}</span>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}