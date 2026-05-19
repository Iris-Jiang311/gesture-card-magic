import { useEffect, useRef, useState } from "react";
import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";
import { motion, AnimatePresence } from "framer-motion";
import "./App.css";

export default function App() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const handLandmarkerRef = useRef(null);

  const selectedCardRef = useRef(null);
  const cardsOpenRef = useRef(false);
  const lastCaptureTimeRef = useRef(0);
  const smoothedPalmXRef = useRef(null);
  const captureStartTimeRef = useRef(null);
  const isCapturingRef = useRef(false);
  const capturedCardsRef = useRef([]);

  const [gesture, setGesture] = useState("No hand detected");
  const [cardsOpen, setCardsOpen] = useState(false);
  const [isCapturingPose, setIsCapturingPose] = useState(false);

  const [palmPosition, setPalmPosition] = useState({ x: 0, y: 0 });
  const [selectedCard, setSelectedCard] = useState(null);
  const [carouselOffset, setCarouselOffset] = useState(0);

  const [selectedRevealCard, setSelectedRevealCard] = useState(null);
  const [selectedCards, setSelectedCards] = useState([]);
  const [captureProgress, setCaptureProgress] = useState(0);

 const cards = [
    "Amine D.",
    "Anna K.",
    "Hanna Å.",
    "Gustav H.",
    "Kaven Q.",
    "William X.",
    "Fiona L.",
    "Iris J.",
    "Peter W.",
    "FAN Y.",
    "MATTIAS F.",
    "JOHANNA J.",
    "THERESA Z.",
    "EMILY Z.",
    "OLIVIA T.",
    "TIAGO NG.",
    "SUMANTH H.",
    "LUCA Z.",
    "NICOLE Y.",
    "SUNNY W.",
    "FELIX W.",
  ];

  useEffect(() => {
    selectedCardRef.current = selectedCard;
  }, [selectedCard]);

  useEffect(() => {
    cardsOpenRef.current = cardsOpen;
  }, [cardsOpen]);

  useEffect(() => {
    capturedCardsRef.current = selectedCards;
  }, [selectedCards]);

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
            const fist = isFistGesture(hand);

            const palmCenter = getPalmCenter(hand);
            const videoRect = video.getBoundingClientRect();

            const screenX =
              videoRect.left + (1 - palmCenter.x) * videoRect.width;
            const screenY = videoRect.top + palmCenter.y * videoRect.height;

            setPalmPosition({
              x: screenX,
              y: screenY,
            });

            if (openPalm) {
              setGesture("Open palm: move your hand to rotate the cards");

              setCardsOpen(true);
              cardsOpenRef.current = true;

              setIsCapturingPose(false);

              updateCarouselByPalm(palmCenter.x);

              captureStartTimeRef.current = null;
              isCapturingRef.current = false;
              setCaptureProgress(0);
            } else if (pointing) {
              const currentSelectedCard = selectedCardRef.current;

              if (currentSelectedCard && cardsOpenRef.current) {
                setGesture(`Confirming selection: ${currentSelectedCard}`);
                setIsCapturingPose(true);

                const now = Date.now();

                if (!captureStartTimeRef.current) {
                  captureStartTimeRef.current = now;
                }

                const holdTime = now - captureStartTimeRef.current;
                const requiredHoldTime = 500;
                const progress = Math.min(holdTime / requiredHoldTime, 1);

                setCaptureProgress(progress);

                if (holdTime >= requiredHoldTime && !isCapturingRef.current) {
                  isCapturingRef.current = true;
                  chooseCard(currentSelectedCard);
                  setGesture(`Selected: ${currentSelectedCard}`);
                  setCaptureProgress(0);
                  captureStartTimeRef.current = null;
                }
              } else {
                setGesture("Point gesture: open your palm first");
                setIsCapturingPose(false);
                setCaptureProgress(0);
                captureStartTimeRef.current = null;
              }
            } else if (fist) {
              setGesture("Fist: hide cards");

              setCardsOpen(false);
              cardsOpenRef.current = false;

              setIsCapturingPose(false);
              setSelectedCard(null);
              selectedCardRef.current = null;

              setCaptureProgress(0);

              captureStartTimeRef.current = null;
              isCapturingRef.current = false;
            } else {
              setGesture("Gesture not recognized");
              setIsCapturingPose(false);
              setCaptureProgress(0);
              captureStartTimeRef.current = null;
            }
          } else {
            setGesture("No hand detected");
            setSelectedCard(null);
            selectedCardRef.current = null;
            setIsCapturingPose(false);
            setCaptureProgress(0);
            captureStartTimeRef.current = null;
          }
        }

        requestAnimationFrame(loop);
      }

      loop();
    }

    init();
  }, []);

  function getAvailableCards() {
    return cards.filter((card) => !capturedCardsRef.current.includes(card));
  }

  function chooseCard(cardName) {
    const now = Date.now();

    if (now - lastCaptureTimeRef.current < 1500) {
      return;
    }

    if (capturedCardsRef.current.includes(cardName)) {
      return;
    }

    lastCaptureTimeRef.current = now;

    const nextSelectedCards = [...capturedCardsRef.current, cardName];
    capturedCardsRef.current = nextSelectedCards;

    setSelectedRevealCard(cardName);

    setCardsOpen(false);
    cardsOpenRef.current = false;

    setIsCapturingPose(false);
    setSelectedCard(null);
    selectedCardRef.current = null;

    setCaptureProgress(0);

    captureStartTimeRef.current = null;
    isCapturingRef.current = false;

    setSelectedCards(nextSelectedCards);

    setTimeout(() => {
      setSelectedRevealCard(null);
    }, 1400);
  }

  function restartGame() {
    setCardsOpen(false);
    cardsOpenRef.current = false;

    setIsCapturingPose(false);
    setSelectedCard(null);
    setSelectedRevealCard(null);
    setSelectedCards([]);
    setCaptureProgress(0);
    setCarouselOffset(0);
    setGesture("No hand detected");

    selectedCardRef.current = null;
    lastCaptureTimeRef.current = 0;
    smoothedPalmXRef.current = null;
    captureStartTimeRef.current = null;
    isCapturingRef.current = false;
    capturedCardsRef.current = [];
  }

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

  function isFistGesture(hand) {
    const indexOpen = isFingerOpen(hand, 8, 6);
    const middleOpen = isFingerOpen(hand, 12, 10);
    const ringOpen = isFingerOpen(hand, 16, 14);
    const pinkyOpen = isFingerOpen(hand, 20, 18);

    return !indexOpen && !middleOpen && !ringOpen && !pinkyOpen;
  }

  function getPalmCenter(hand) {
    const palmPoints = [0, 5, 9, 13, 17];

    const center = palmPoints.reduce(
      (acc, index) => {
        acc.x += hand[index].x;
        acc.y += hand[index].y;
        return acc;
      },
      { x: 0, y: 0 }
    );

    return {
      x: center.x / palmPoints.length,
      y: center.y / palmPoints.length,
    };
  }

  function updateCarouselByPalm(palmX) {
    const availableCards = getAvailableCards();

    if (availableCards.length === 0) {
      setCardsOpen(false);
      cardsOpenRef.current = false;
      setSelectedCard(null);
      selectedCardRef.current = null;
      setGesture("All cards selected");
      return;
    }

    const mirroredX = 1 - palmX;

    if (smoothedPalmXRef.current === null) {
      smoothedPalmXRef.current = mirroredX;
    }

    smoothedPalmXRef.current =
      smoothedPalmXRef.current * 0.9 + mirroredX * 0.1;

    const x = smoothedPalmXRef.current;
    const offset = (x - 0.5) * 14;

    setCarouselOffset(offset);

    let frontCard = availableCards[0];
    let maxZ = -Infinity;

    availableCards.forEach((card, index) => {
      const baseAngle = (360 / availableCards.length) * index;
      const rotationAngle = offset * 90;
      const angle = baseAngle + rotationAngle;
      const angleRad = (angle * Math.PI) / 180;
      const z = Math.cos(angleRad) * 480;

      if (z > maxZ) {
        maxZ = z;
        frontCard = card;
      }
    });

    selectedCardRef.current = frontCard;
    setSelectedCard(frontCard);
  }

  function drawHandPoints(ctx, hand, width, height) {
    ctx.fillStyle = "white";

    hand.forEach((point) => {
      ctx.beginPath();
      ctx.arc(point.x * width, point.y * height, 5, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  const availableCardsForRender = cards.filter(
    (card) => !selectedCards.includes(card)
  );

  return (
    <div className="page">
      <div className="magicBackground">
        <span className="orb orb1"></span>
        <span className="orb orb2"></span>
        <span className="orb orb3"></span>
      </div>

      <div className="topBar">
        <div>
          <h1>Gesture Card Magic</h1>
          <p className="subtitle">
            Open palm to reveal, move your hand to rotate, point to confirm.
          </p>
        </div>

        <button className="restartButton" onClick={restartGame}>
          Restart
        </button>
      </div>

      <div className="statusPanel">
        <div className="gestureBox">{gesture}</div>

        {cardsOpen && (
          <div className="selectedBox">
            Move your hand to rotate the cards. Point to select the front card.
          </div>
        )}

        {cardsOpen && selectedCard && captureProgress > 0 && (
          <div className="captureProgressBox">
            <div
              className="captureProgressBar"
              style={{ width: `${captureProgress * 100}%` }}
            />
          </div>
        )}
      </div>

      <div className="cameraArea">
        <video ref={videoRef} autoPlay playsInline muted />
        <canvas ref={canvasRef} />
      </div>

      {cardsOpen && (
        <motion.div
          className="palmCursor"
          animate={{
            x: palmPosition.x - 15,
            y: palmPosition.y - 15,
          }}
          transition={{
            type: "spring",
            stiffness: 300,
            damping: 30,
          }}
        />
      )}

      <div className="magicCircleArea">
        {cardsOpen && <div className="mainMagicCircle"></div>}

        <div className="cardArea3D">
          {availableCardsForRender.map((card, index) => {
            const totalCards = availableCardsForRender.length || 1;
            const baseAngle = (360 / totalCards) * index;

            const rotationSpeed = 90;
            const radiusX = isCapturingPose ? 30 : 560;
            const radiusZ = isCapturingPose ? 0 : 480;

            const rotationAngle = carouselOffset * rotationSpeed;
            const angle = baseAngle + rotationAngle;
            const angleRad = (angle * Math.PI) / 180;

            const x = Math.sin(angleRad) * radiusX;
            const z = Math.cos(angleRad) * radiusZ;

            const depthScale =
              0.58 + ((z + radiusZ) / (radiusZ * 2 || 1)) * 0.48;

            const opacityByDepth =
              0.28 + ((z + radiusZ) / (radiusZ * 2 || 1)) * 0.72;

            const isFront = z > radiusZ * 0.82;
            const isSelected = selectedCard === card || isFront;

            return (
              <motion.div
                key={card}
                data-card={card}
                className={`card card3D ${isSelected ? "selected" : ""}`}
                animate={{
                  x: cardsOpen ? x : 0,
                  y: cardsOpen ? 0 : 45,
                  scale: cardsOpen
                    ? isSelected
                      ? depthScale + 0.16
                      : depthScale
                    : 0.82,
                  opacity: cardsOpen ? opacityByDepth : 0.25,
                  rotateY: cardsOpen ? -angle : 0,
                  rotateZ: isCapturingPose ? index * 1.5 : 0,
                  zIndex: Math.round(z + 500),
                }}
                transition={{
                  type: "spring",
                  stiffness: 120,
                  damping: 18,
                }}
              >
                {isSelected && cardsOpen && !isCapturingPose && (
                  <div className="magicRing">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                )}

                <img
                  className="cardBackImage"
                  src="/next-era-card-back.png"
                  alt="NEXT ERA card back"
                />
              </motion.div>
            );
          })}
        </div>
      </div>

      <AnimatePresence>
        {selectedRevealCard && (
          <motion.div
            className="captureStage"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="captureBurst"
              initial={{ scale: 0.2, opacity: 0 }}
              animate={{ scale: 2.4, opacity: 1 }}
              exit={{ scale: 3, opacity: 0 }}
              transition={{ duration: 0.8 }}
            />

            <motion.div
              className="selectedCardReveal"
              initial={{ opacity: 0, scale: 0.55, rotate: -8 }}
              animate={{ opacity: 1, scale: 1.18, rotate: 0 }}
              exit={{ opacity: 0, scale: 0.55, rotate: 8 }}
              transition={{ type: "spring", stiffness: 120, damping: 16 }}
            >
              <div className="selectedCardGlow"></div>

              <div className="selectedNameOnly">
                <span>{selectedRevealCard}</span>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="capturedList">
        <h2>Selected Cards</h2>

        {selectedCards.length === 0 ? (
          <p>No cards selected yet</p>
        ) : (
          <div className="capturedItems">
            {selectedCards.map((card) => (
              <div key={card} className="capturedItem">
                {card}
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedCards.length === cards.length && (
        <div className="completeBox">
          <h2>Congratulations!</h2>
          <p>You have selected all cards.</p>
          <button className="primaryButton" onClick={restartGame}>
            Play Again
          </button>
        </div>
      )}
    </div>
  );
}
