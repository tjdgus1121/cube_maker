import React, { useState, useRef, useEffect } from 'react';
import { Upload, Download, ZoomIn, ZoomOut, Pipette } from 'lucide-react';

const CubePatternGenerator = () => {
  const [uploadedImage, setUploadedImage] = useState(null);
  const [pixelSize, setPixelSize] = useState(30);
  const [pixelWidth, setPixelWidth] = useState(30);
  const [pixelHeight, setPixelHeight] = useState(30);
  const [useCustomDimensions, setUseCustomDimensions] = useState(false);
  const [colors, setColors] = useState([
    '#FFFFFF', // White - 흰색
    '#000000', // Black - 검정
    '#FF0000', // Red - 빨강
    '#0000FF', // Blue - 파랑
    '#FFFF00', // Yellow - 노랑
    '#00FF00'  // Green - 초록
  ]);
  const [pixelatedData, setPixelatedData] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeColorPicker, setActiveColorPicker] = useState(null);
  const [isPipetteMode, setPipetteMode] = useState(false);
  const [pipetteColorIndex, setPipetteColorIndex] = useState(null);
  const [showTutorial, setShowTutorial] = useState(true);
  const [showThickGrid, setShowThickGrid] = useState(true);
  const [colorMode, setColorMode] = useState('auto'); // 'auto' or 'manual'
  const [mandatorySixColors, setMandatorySixColors] = useState(false);
  const [hoveredPixel, setHoveredPixel] = useState(null); // { x, y, color }
  const [selectedPixel, setSelectedPixel] = useState(null); // { x, y, color }
  
  const fileInputRef = useRef(null);
  const canvasRef = useRef(null);
  const outputCanvasRef = useRef(null);
  const originalImageRef = useRef(null);

  // Extract dominant colors from image
  const extractDominantColors = (imageData, numColors = 6) => {
    const pixels = [];
    for (let i = 0; i < imageData.data.length; i += 4) {
      pixels.push([
        imageData.data[i],
        imageData.data[i + 1],
        imageData.data[i + 2]
      ]);
    }

    // K-means clustering for color extraction
    let centroids = [];
    for (let i = 0; i < numColors; i++) {
      const randomPixel = pixels[Math.floor(Math.random() * pixels.length)];
      centroids.push([...randomPixel]);
    }

    for (let iteration = 0; iteration < 10; iteration++) {
      const clusters = Array(numColors).fill().map(() => []);
      
      pixels.forEach(pixel => {
        let minDist = Infinity;
        let clusterIndex = 0;
        
        centroids.forEach((centroid, i) => {
          const dist = Math.sqrt(
            Math.pow(pixel[0] - centroid[0], 2) +
            Math.pow(pixel[1] - centroid[1], 2) +
            Math.pow(pixel[2] - centroid[2], 2)
          );
          if (dist < minDist) {
            minDist = dist;
            clusterIndex = i;
          }
        });
        
        clusters[clusterIndex].push(pixel);
      });

      centroids = clusters.map(cluster => {
        if (cluster.length === 0) return centroids[0];
        const sum = cluster.reduce((acc, pixel) => [
          acc[0] + pixel[0],
          acc[1] + pixel[1],
          acc[2] + pixel[2]
        ], [0, 0, 0]);
        return [
          Math.round(sum[0] / cluster.length),
          Math.round(sum[1] / cluster.length),
          Math.round(sum[2] / cluster.length)
        ];
      });
    }

    return centroids.map(c => 
      `#${c.map(v => v.toString(16).padStart(2, '0')).join('')}`
    );
  };

  // Find closest color using weighted RGB (human eye is more sensitive to green)
  const findClosestColor = (r, g, b, palette) => {
    let minDist = Infinity;
    let closestColor = palette[0];
    
    palette.forEach(color => {
      const hexR = parseInt(color.slice(1, 3), 16);
      const hexG = parseInt(color.slice(3, 5), 16);
      const hexB = parseInt(color.slice(5, 7), 16);
      
      // Weighted RGB distance - human eye is more sensitive to green
      // Standard weights: R=0.3, G=0.59, B=0.11
      const dist = Math.sqrt(
        0.30 * Math.pow(r - hexR, 2) +
        0.59 * Math.pow(g - hexG, 2) +
        0.11 * Math.pow(b - hexB, 2)
      );
      
      if (dist < minDist) {
        minDist = dist;
        closestColor = color;
      }
    });
    
    return closestColor;
  };

  // Calculate color distance using weighted RGB
  const calculateColorDistance = (color1, color2) => {
    const r1 = parseInt(color1.slice(1, 3), 16);
    const g1 = parseInt(color1.slice(3, 5), 16);
    const b1 = parseInt(color1.slice(5, 7), 16);
    
    const r2 = parseInt(color2.slice(1, 3), 16);
    const g2 = parseInt(color2.slice(3, 5), 16);
    const b2 = parseInt(color2.slice(5, 7), 16);
    
    return Math.sqrt(
      0.30 * Math.pow(r1 - r2, 2) +
      0.59 * Math.pow(g1 - g2, 2) +
      0.11 * Math.pow(b1 - b2, 2)
    );
  };

  // Hungarian Algorithm for optimal color assignment
  const hungarianAssignment = (costMatrix) => {
    const n = costMatrix.length;
    const assignment = new Array(n).fill(-1);
    const rowCovered = new Array(n).fill(false);
    const colCovered = new Array(n).fill(false);
    
    // Step 1: Subtract row minimums
    const matrix = costMatrix.map(row => {
      const min = Math.min(...row);
      return row.map(val => val - min);
    });
    
    // Step 2: Subtract column minimums
    for (let col = 0; col < n; col++) {
      let min = Infinity;
      for (let row = 0; row < n; row++) {
        min = Math.min(min, matrix[row][col]);
      }
      for (let row = 0; row < n; row++) {
        matrix[row][col] -= min;
      }
    }
    
    // Step 3: Greedy assignment (simplified for 6x6)
    const used = new Array(n).fill(false);
    for (let row = 0; row < n; row++) {
      for (let col = 0; col < n; col++) {
        if (matrix[row][col] === 0 && !used[col]) {
          assignment[row] = col;
          used[col] = true;
          break;
        }
      }
    }
    
    // Fill any unassigned with remaining colors
    for (let row = 0; row < n; row++) {
      if (assignment[row] === -1) {
        for (let col = 0; col < n; col++) {
          if (!used[col]) {
            assignment[row] = col;
            used[col] = true;
            break;
          }
        }
      }
    }
    
    return assignment;
  };

  // Extract 6 regions using K-means and assign user colors optimally
  const extractRegionsAndAssignColors = (imageData, userColors) => {
    // Extract 6 dominant regions using K-means
    const regionColors = extractDominantColors(imageData, 6);
    
    // Count pixels in each region
    const regionSizes = new Array(6).fill(0);
    const cols = imageData.width;
    const rows = imageData.height;
    
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const i = (y * cols + x) * 4;
        const r = imageData.data[i];
        const g = imageData.data[i + 1];
        const b = imageData.data[i + 2];
        
        // Find which region this pixel belongs to
        let minDist = Infinity;
        let regionIndex = 0;
        regionColors.forEach((color, idx) => {
          const hexR = parseInt(color.slice(1, 3), 16);
          const hexG = parseInt(color.slice(3, 5), 16);
          const hexB = parseInt(color.slice(5, 7), 16);
          const dist = calculateColorDistance(
            `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`,
            color
          );
          if (dist < minDist) {
            minDist = dist;
            regionIndex = idx;
          }
        });
        regionSizes[regionIndex]++;
      }
    }
    
    // Sort regions by size (largest first)
    const regionIndices = regionColors.map((_, i) => i);
    regionIndices.sort((a, b) => regionSizes[b] - regionSizes[a]);
    
    // Create cost matrix: distance between each region color and user color
    const costMatrix = regionIndices.map(regionIdx => 
      userColors.map(userColor => 
        calculateColorDistance(regionColors[regionIdx], userColor)
      )
    );
    
    // Use Hungarian algorithm to find optimal assignment
    const assignment = hungarianAssignment(costMatrix);
    
    // Create mapping: region color -> user color
    const colorMapping = {};
    regionIndices.forEach((regionIdx, i) => {
      colorMapping[regionColors[regionIdx]] = userColors[assignment[i]];
    });
    
    return { regionColors, colorMapping };
  };

  // Process image into pixelated version
  const processImage = () => {
    if (!uploadedImage) return;
    
    setIsProcessing(true);
    
    const img = new Image();
    img.onload = () => {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      
      // Calculate dimensions
      let cols, rows;
      if (useCustomDimensions) {
        // Convert to number, fallback to 30 if empty or invalid
        cols = parseInt(pixelWidth) || 30;
        rows = parseInt(pixelHeight) || 30;
      } else {
        cols = pixelSize;
        const aspectRatio = img.height / img.width;
        rows = Math.round(cols * aspectRatio);
      }
      
      canvas.width = cols;
      canvas.height = rows;
      
      ctx.drawImage(img, 0, 0, cols, rows);
      const imageData = ctx.getImageData(0, 0, cols, rows);
      
      // Handle color extraction based on mode
      let activeColors;
      let colorMapping = null;
      
      if (colorMode === 'auto') {
        const detectedColors = extractDominantColors(imageData, 6);
        setColors(detectedColors);
        activeColors = detectedColors;
      } else {
        // Manual mode
        if (mandatorySixColors) {
          // Use Hungarian algorithm for optimal 6-color assignment
          const result = extractRegionsAndAssignColors(imageData, colors);
          colorMapping = result.colorMapping;
          activeColors = result.regionColors;
        } else {
          // Use current user-selected colors
          activeColors = colors;
        }
      }
      
      // Create pixel art
      const pixelData = [];
      for (let y = 0; y < rows; y++) {
        const row = [];
        for (let x = 0; x < cols; x++) {
          const i = (y * cols + x) * 4;
          const r = imageData.data[i];
          const g = imageData.data[i + 1];
          const b = imageData.data[i + 2];
          
          let color;
          if (mandatorySixColors && colorMapping) {
            // Find which region this pixel belongs to
            const closestRegion = findClosestColor(r, g, b, activeColors);
            // Map to user color
            color = colorMapping[closestRegion];
          } else {
            // Normal closest color matching
            color = findClosestColor(r, g, b, activeColors);
          }
          
          row.push(color);
        }
        pixelData.push(row);
      }
      
      setPixelatedData(pixelData);
      setIsProcessing(false);
    };
    
    img.src = uploadedImage;
  };

  // Reprocess with current colors
  const reprocessWithCurrentColors = () => {
    if (!uploadedImage) return;
    
    const img = new Image();
    img.onload = () => {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      
      let cols, rows;
      if (useCustomDimensions) {
        // Convert to number, fallback to 30 if empty or invalid
        cols = parseInt(pixelWidth) || 30;
        rows = parseInt(pixelHeight) || 30;
      } else {
        cols = pixelSize;
        const aspectRatio = img.height / img.width;
        rows = Math.round(cols * aspectRatio);
      }
      
      canvas.width = cols;
      canvas.height = rows;
      
      ctx.drawImage(img, 0, 0, cols, rows);
      const imageData = ctx.getImageData(0, 0, cols, rows);
      
      // Handle color mode
      let activeColors;
      let colorMapping = null;
      
      if (colorMode === 'manual' && mandatorySixColors) {
        // Use Hungarian algorithm for optimal 6-color assignment
        const result = extractRegionsAndAssignColors(imageData, colors);
        colorMapping = result.colorMapping;
        activeColors = result.regionColors;
      } else {
        // Use current colors
        activeColors = colors;
      }
      
      const pixelData = [];
      for (let y = 0; y < rows; y++) {
        const row = [];
        for (let x = 0; x < cols; x++) {
          const i = (y * cols + x) * 4;
          const r = imageData.data[i];
          const g = imageData.data[i + 1];
          const b = imageData.data[i + 2];
          
          let color;
          if (mandatorySixColors && colorMapping) {
            // Find which region this pixel belongs to
            const closestRegion = findClosestColor(r, g, b, activeColors);
            // Map to user color
            color = colorMapping[closestRegion];
          } else {
            // Normal closest color matching
            color = findClosestColor(r, g, b, activeColors);
          }
          
          row.push(color);
        }
        pixelData.push(row);
      }
      
      setPixelatedData(pixelData);
    };
    
    img.src = uploadedImage;
  };

  // Handle file upload
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setUploadedImage(event.target.result);
        originalImageRef.current = event.target.result;
      };
      reader.readAsDataURL(file);
    }
  };

  // Draw output canvas
  useEffect(() => {
    if (!pixelatedData) return;
    
    const canvas = outputCanvasRef.current;
    const ctx = canvas.getContext('2d');
    
    const cellSize = 20;
    const cols = pixelatedData[0].length;
    const rows = pixelatedData.length;
    
    canvas.width = cols * cellSize;
    canvas.height = rows * cellSize;
    
    // Draw pixels
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        ctx.fillStyle = pixelatedData[y][x];
        ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
      }
    }
    
    // Draw grid lines
    for (let y = 0; y <= rows; y++) {
      // Determine line thickness
      const isThickLine = showThickGrid && (y % 3 === 0);
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = isThickLine ? 3 : 1;
      
      ctx.beginPath();
      ctx.moveTo(0, y * cellSize);
      ctx.lineTo(cols * cellSize, y * cellSize);
      ctx.stroke();
    }
    
    for (let x = 0; x <= cols; x++) {
      // Determine line thickness
      const isThickLine = showThickGrid && (x % 3 === 0);
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = isThickLine ? 3 : 1;
      
      ctx.beginPath();
      ctx.moveTo(x * cellSize, 0);
      ctx.lineTo(x * cellSize, rows * cellSize);
      ctx.stroke();
    }
  }, [pixelatedData, showThickGrid]);

  // Process image when uploaded or pixel size changes
  useEffect(() => {
    if (uploadedImage) {
      processImage();
    }
  }, [uploadedImage, pixelSize, pixelWidth, pixelHeight, useCustomDimensions, colorMode, mandatorySixColors]);

  // Reprocess when colors change
  useEffect(() => {
    if (uploadedImage && pixelatedData) {
      reprocessWithCurrentColors();
    }
  }, [colors]);

  // Reprocess when mandatory mode changes
  useEffect(() => {
    if (uploadedImage && colorMode === 'manual' && mandatorySixColors) {
      processImage();
    }
  }, [mandatorySixColors]);

  // Download image
  const downloadImage = () => {
    if (!outputCanvasRef.current) return;
    
    const link = document.createElement('a');
    link.download = 'cube-pattern.png';
    link.href = outputCanvasRef.current.toDataURL();
    link.click();
  };

  // Handle canvas click for pipette
  const handleCanvasClick = (e) => {
    const canvas = outputCanvasRef.current;
    if (!canvas || !pixelatedData) return;
    
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = Math.floor((e.clientX - rect.left) * scaleX);
    const y = Math.floor((e.clientY - rect.top) * scaleY);
    
    const cellSize = 20;
    const pixelX = Math.floor(x / cellSize);
    const pixelY = Math.floor(y / cellSize);
    
    // Check if in bounds
    if (pixelY >= 0 && pixelY < pixelatedData.length && 
        pixelX >= 0 && pixelX < pixelatedData[0].length) {
      
      // Pipette mode - change color
      if (isPipetteMode && pipetteColorIndex !== null) {
        const ctx = canvas.getContext('2d');
        const pixel = ctx.getImageData(x, y, 1, 1).data;
        const pickedColor = `#${[pixel[0], pixel[1], pixel[2]].map(v => 
          v.toString(16).padStart(2, '0')).join('')}`;
        
        const newColors = [...colors];
        newColors[pipetteColorIndex] = pickedColor;
        setColors(newColors);
        setPipetteMode(false);
        setPipetteColorIndex(null);
      } else {
        // Select pixel
        const color = pixelatedData[pixelY][pixelX];
        setSelectedPixel({ x: pixelX, y: pixelY, color });
      }
    }
  };

  // Handle canvas hover for pixel info
  const handleCanvasHover = (e) => {
    const canvas = outputCanvasRef.current;
    if (!canvas || !pixelatedData) return;
    
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = Math.floor((e.clientX - rect.left) * scaleX);
    const y = Math.floor((e.clientY - rect.top) * scaleY);
    
    const cellSize = 20;
    const pixelX = Math.floor(x / cellSize);
    const pixelY = Math.floor(y / cellSize);
    
    // Check if in bounds
    if (pixelY >= 0 && pixelY < pixelatedData.length && 
        pixelX >= 0 && pixelX < pixelatedData[0].length) {
      const color = pixelatedData[pixelY][pixelX];
      setHoveredPixel({ x: pixelX, y: pixelY, color });
    } else {
      setHoveredPixel(null);
    }
  };

  // Handle canvas mouse leave
  const handleCanvasLeave = () => {
    setHoveredPixel(null);
  };

  // Change selected pixel color
  const changePixelColor = (newColor) => {
    if (!selectedPixel || !pixelatedData) return;
    
    const newPixelData = pixelatedData.map((row, y) =>
      row.map((color, x) =>
        x === selectedPixel.x && y === selectedPixel.y ? newColor : color
      )
    );
    
    setPixelatedData(newPixelData);
    setSelectedPixel({ ...selectedPixel, color: newColor });
  };

  return (
    <div style={{ 
      minHeight: '100vh',
      padding: '20px', 
      fontFamily: 'Arial, sans-serif',
      backgroundColor: '#f0f4f8'
    }}>
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto'
      }}>
      {/* Header */}
      <div style={{
        maxWidth: '100%',
        textAlign: 'center',
        marginBottom: '30px',
        padding: '30px',
        backgroundColor: 'white',
        borderRadius: '15px',
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
        marginLeft: 'auto',
        marginRight: 'auto'
      }}>
        <h1 style={{ 
          color: '#2c3e50',
          marginBottom: '10px',
          fontSize: '36px',
          fontWeight: 'bold'
        }}>
          🎨 큐브 도안 생성기
        </h1>
        <p style={{
          color: '#7f8c8d',
          fontSize: '18px',
          marginBottom: '20px'
        }}>
          이미지를 업로드하여 6가지 색상의 큐브 크로스스티치 도안으로 변환하세요
        </p>
        <button
          onClick={() => setShowTutorial(!showTutorial)}
          style={{
            padding: '10px 20px',
            backgroundColor: showTutorial ? '#e74c3c' : '#3498db',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 'bold'
          }}
        >
          {showTutorial ? '📖 사용 가이드 숨기기' : '📖 사용 가이드 보기'}
        </button>
      </div>

      {/* Tutorial Section */}
      {showTutorial && (
        <div style={{
          marginBottom: '30px',
          padding: '30px',
          backgroundColor: 'white',
          borderRadius: '15px',
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
          border: '3px solid #3498db',
          marginLeft: 'auto',
          marginRight: 'auto'
        }}>
          <h2 style={{
            color: '#2c3e50',
            marginBottom: '25px',
            fontSize: '24px',
            textAlign: 'center'
          }}>
            📋 큐브 도안 만들기 - 단계별 가이드
          </h2>
          
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '15px',
            marginBottom: '30px'
          }}>
            {/* Step 1 */}
            <div style={{
              padding: '15px',
              backgroundColor: '#ecf0f1',
              borderRadius: '10px',
              borderLeft: '5px solid #3498db'
            }}>
              <div style={{
                fontSize: '28px',
                marginBottom: '8px'
              }}>1️⃣</div>
              <h3 style={{ color: '#2c3e50', marginBottom: '8px', fontSize: '16px' }}>이미지 업로드</h3>
              <p style={{ color: '#7f8c8d', lineHeight: '1.5', fontSize: '13px', margin: 0 }}>
                <strong>"이미지 업로드"</strong> 버튼을 클릭하여 변환하고 싶은 이미지를 선택하세요. 
                JPG, PNG 등 대부분의 이미지 형식을 지원합니다.
              </p>
            </div>

            {/* Step 2 */}
            <div style={{
              padding: '15px',
              backgroundColor: '#ecf0f1',
              borderRadius: '10px',
              borderLeft: '5px solid #9b59b6'
            }}>
              <div style={{
                fontSize: '28px',
                marginBottom: '8px'
              }}>2️⃣</div>
              <h3 style={{ color: '#2c3e50', marginBottom: '8px', fontSize: '16px' }}>픽셀 크기 설정</h3>
              <p style={{ color: '#7f8c8d', lineHeight: '1.5', fontSize: '13px', margin: 0 }}>
                <strong>+/- 버튼</strong>으로 간단하게 조절하거나, <strong>"직접 입력"</strong> 체크박스를 
                활성화하여 정확한 픽셀 수를 입력하세요. (예: 30×30, 90×90)
              </p>
            </div>

            {/* Step 3 */}
            <div style={{
              padding: '15px',
              backgroundColor: '#ecf0f1',
              borderRadius: '10px',
              borderLeft: '5px solid #e67e22'
            }}>
              <div style={{
                fontSize: '28px',
                marginBottom: '8px'
              }}>3️⃣</div>
              <h3 style={{ color: '#2c3e50', marginBottom: '8px', fontSize: '16px' }}>색상 조정</h3>
              <p style={{ color: '#7f8c8d', lineHeight: '1.5', fontSize: '13px', margin: 0 }}>
                자동으로 추출된 6가지 색상을 <strong>컬러 피커</strong>로 직접 수정하거나, 
                <strong>스포이드 버튼</strong>으로 도안에서 원하는 색상을 선택하세요.
              </p>
            </div>

            {/* Step 4 */}
            <div style={{
              padding: '15px',
              backgroundColor: '#ecf0f1',
              borderRadius: '10px',
              borderLeft: '5px solid #27ae60'
            }}>
              <div style={{
                fontSize: '28px',
                marginBottom: '8px'
              }}>4️⃣</div>
              <h3 style={{ color: '#2c3e50', marginBottom: '8px', fontSize: '16px' }}>확대/축소로 확인</h3>
              <p style={{ color: '#7f8c8d', lineHeight: '1.5', fontSize: '13px', margin: 0 }}>
                생성된 도안을 <strong>+/- 확대/축소 버튼</strong>으로 자세히 살펴보세요. 
                50%부터 300%까지 조절 가능합니다.
              </p>
            </div>

            {/* Step 5 */}
            <div style={{
              padding: '15px',
              backgroundColor: '#ecf0f1',
              borderRadius: '10px',
              borderLeft: '5px solid #e74c3c'
            }}>
              <div style={{
                fontSize: '28px',
                marginBottom: '8px'
              }}>5️⃣</div>
              <h3 style={{ color: '#2c3e50', marginBottom: '8px', fontSize: '16px' }}>도안 다운로드</h3>
              <p style={{ color: '#7f8c8d', lineHeight: '1.5', fontSize: '13px', margin: 0 }}>
                만족스러운 결과가 나왔다면 <strong>"다운로드"</strong> 버튼을 클릭하여 
                PNG 파일로 저장하고 큐브 작업을 시작하세요!
              </p>
            </div>

            {/* Tip */}
            <div style={{
              padding: '15px',
              backgroundColor: '#fff3cd',
              borderRadius: '10px',
              borderLeft: '5px solid #ffc107'
            }}>
              <div style={{
                fontSize: '28px',
                marginBottom: '8px'
              }}>💡</div>
              <h3 style={{ color: '#2c3e50', marginBottom: '8px', fontSize: '16px' }}>꿀팁!</h3>
              <p style={{ color: '#7f8c8d', lineHeight: '1.5', fontSize: '13px', margin: 0 }}>
                도안 크기는 작업 시간과 난이도에 영향을 줍니다. 
                <strong>30×30</strong>은 초보자용, <strong>90×90</strong>은 고급 작품에 적합합니다.
              </p>
            </div>
          </div>

          {/* Button descriptions */}
          <div style={{
            padding: '20px',
            backgroundColor: '#e8f4f8',
            borderRadius: '10px',
            marginTop: '20px'
          }}>
            <h3 style={{
              color: '#2c3e50',
              marginBottom: '15px',
              textAlign: 'center'
            }}>
              🎯 버튼 기능 설명
            </h3>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '15px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  backgroundColor: '#4CAF50',
                  borderRadius: '5px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontSize: '20px'
                }}>📤</div>
                <div>
                  <strong>이미지 업로드</strong>
                  <p style={{ margin: 0, fontSize: '12px', color: '#7f8c8d' }}>
                    변환할 이미지 선택
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  backgroundColor: '#2196F3',
                  borderRadius: '5px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontSize: '20px',
                  fontWeight: 'bold'
                }}>±</div>
                <div>
                  <strong>픽셀 크기 조절</strong>
                  <p style={{ margin: 0, fontSize: '12px', color: '#7f8c8d' }}>
                    도안의 픽셀 수 증감
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  backgroundColor: '#9C27B0',
                  borderRadius: '5px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontSize: '20px'
                }}>✓</div>
                <div>
                  <strong>직접 입력</strong>
                  <p style={{ margin: 0, fontSize: '12px', color: '#7f8c8d' }}>
                    정확한 가로×세로 픽셀 입력
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  backgroundColor: '#FF9800',
                  borderRadius: '5px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontSize: '20px'
                }}>🔍</div>
                <div>
                  <strong>확대/축소</strong>
                  <p style={{ margin: 0, fontSize: '12px', color: '#7f8c8d' }}>
                    도안을 크게/작게 보기
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  backgroundColor: '#607D8B',
                  borderRadius: '5px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontSize: '20px'
                }}>💧</div>
                <div>
                  <strong>스포이드</strong>
                  <p style={{ margin: 0, fontSize: '12px', color: '#7f8c8d' }}>
                    도안에서 색상 추출
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  backgroundColor: '#9C27B0',
                  borderRadius: '5px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontSize: '20px'
                }}>💾</div>
                <div>
                  <strong>다운로드</strong>
                  <p style={{ margin: 0, fontSize: '12px', color: '#7f8c8d' }}>
                    PNG 파일로 저장
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Color Mode Selection - Before Image Upload */}
      <div style={{
        marginBottom: '20px',
        padding: '25px',
        backgroundColor: 'white',
        borderRadius: '15px',
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
        marginLeft: 'auto',
        marginRight: 'auto'
      }}>
        <h2 style={{
          color: '#2c3e50',
          marginBottom: '20px',
          fontSize: '20px',
          textAlign: 'center',
          borderBottom: '2px solid #9b59b6',
          paddingBottom: '10px'
        }}>
          🎨 1️⃣ 색상 모드 선택
        </h2>

        {/* Mode Toggle Buttons */}
        <div style={{
          display: 'flex',
          gap: '15px',
          marginBottom: '25px',
          justifyContent: 'center',
          flexWrap: 'wrap'
        }}>
          <button
            onClick={() => setColorMode('auto')}
            style={{
              padding: '15px 40px',
              backgroundColor: colorMode === 'auto' ? '#3498db' : '#ecf0f1',
              color: colorMode === 'auto' ? 'white' : '#7f8c8d',
              border: colorMode === 'auto' ? '3px solid #2980b9' : '2px solid #bdc3c7',
              borderRadius: '10px',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: 'bold',
              transition: 'all 0.3s',
              boxShadow: colorMode === 'auto' ? '0 4px 8px rgba(0,0,0,0.2)' : 'none'
            }}
          >
            🤖 자동 색상 추출
          </button>
          <button
            onClick={() => setColorMode('manual')}
            style={{
              padding: '15px 40px',
              backgroundColor: colorMode === 'manual' ? '#e67e22' : '#ecf0f1',
              color: colorMode === 'manual' ? 'white' : '#7f8c8d',
              border: colorMode === 'manual' ? '3px solid #d35400' : '2px solid #bdc3c7',
              borderRadius: '10px',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: 'bold',
              transition: 'all 0.3s',
              boxShadow: colorMode === 'manual' ? '0 4px 8px rgba(0,0,0,0.2)' : 'none'
            }}
          >
            ✋ 수동 색상 선택
          </button>
        </div>

        {/* Mode Description */}
        <div style={{
          padding: '15px',
          backgroundColor: colorMode === 'auto' ? '#e3f2fd' : '#fff3e0',
          borderRadius: '8px',
          marginBottom: '20px',
          border: `2px solid ${colorMode === 'auto' ? '#2196F3' : '#ff9800'}`
        }}>
          <p style={{ 
            margin: 0, 
            color: '#2c3e50', 
            fontSize: '14px',
            lineHeight: '1.6',
            textAlign: 'center'
          }}>
            {colorMode === 'auto' ? (
              <>
                <strong>🤖 자동 모드:</strong> 이미지 업로드 시 자동으로 6가지 대표 색상을 추출합니다.
              </>
            ) : (
              <>
                <strong>✋ 수동 모드:</strong> 아래에서 원하는 6가지 색상을 먼저 선택하세요. 이미지는 선택한 색상으로만 변환됩니다!
              </>
            )}
          </p>
        </div>

        {/* Manual Color Picker - 2 rows x 3 columns */}
        {colorMode === 'manual' && (
          <div style={{
            padding: '20px',
            backgroundColor: '#fef5e7',
            borderRadius: '10px',
            border: '3px solid #f39c12'
          }}>
            <h3 style={{
              textAlign: 'center',
              color: '#2c3e50',
              marginBottom: '20px',
              fontSize: '18px'
            }}>
              🎨 6가지 색상 선택 (큐브 기본 색상)
            </h3>

            {/* Mandatory 6-Color Checkbox */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              padding: '15px',
              backgroundColor: mandatorySixColors ? '#d4edda' : '#fff3cd',
              borderRadius: '8px',
              marginBottom: '20px',
              border: `3px solid ${mandatorySixColors ? '#28a745' : '#ffc107'}`
            }}>
              <input
                type="checkbox"
                id="mandatorySixColors"
                checked={mandatorySixColors}
                onChange={(e) => setMandatorySixColors(e.target.checked)}
                style={{
                  width: '24px',
                  height: '24px',
                  cursor: 'pointer'
                }}
              />
              <label 
                htmlFor="mandatorySixColors" 
                style={{ 
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  userSelect: 'none',
                  color: '#2c3e50',
                  fontSize: '16px'
                }}
              >
                ✅ 6색 필수 사용
              </label>
            </div>

            {/* Description for mandatory mode */}
            {mandatorySixColors && (
              <div style={{
                padding: '12px',
                backgroundColor: '#d1ecf1',
                borderRadius: '8px',
                marginBottom: '20px',
                border: '2px solid #17a2b8'
              }}>
                <p style={{
                  margin: 0,
                  color: '#004085',
                  fontSize: '13px',
                  lineHeight: '1.6',
                  textAlign: 'center'
                }}>
                  <strong>🎯 6색 필수 모드:</strong> 이미지를 6개 영역으로 분석하고, 
                  각 영역에 선택한 6가지 색상을 최적으로 배정합니다. 
                  모든 색상이 정확히 한 번씩 사용됩니다!
                </p>
              </div>
            )}
            
            {/* Row 1: Colors 1-3 */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '20px',
              marginBottom: '20px'
            }}>
              {colors.slice(0, 3).map((color, index) => (
                <div key={index} style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '15px',
                  backgroundColor: 'white',
                  borderRadius: '10px',
                  border: '2px solid #e67e22'
                }}>
                  <label style={{
                    fontWeight: 'bold',
                    color: '#2c3e50',
                    fontSize: '14px'
                  }}>
                    색상 {index + 1}
                  </label>
                  <div style={{
                    width: '80px',
                    height: '80px',
                    backgroundColor: color,
                    border: '3px solid #333',
                    borderRadius: '10px',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                  }} />
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => {
                      const newColors = [...colors];
                      newColors[index] = e.target.value;
                      setColors(newColors);
                    }}
                    style={{
                      width: '80px',
                      height: '40px',
                      border: '2px solid #333',
                      borderRadius: '5px',
                      cursor: 'pointer'
                    }}
                  />
                  <span style={{
                    fontSize: '11px',
                    fontWeight: 'bold',
                    color: '#7f8c8d',
                    fontFamily: 'monospace'
                  }}>
                    {color.toUpperCase()}
                  </span>
                </div>
              ))}
            </div>

            {/* Row 2: Colors 4-6 */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '20px'
            }}>
              {colors.slice(3, 6).map((color, index) => (
                <div key={index + 3} style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '15px',
                  backgroundColor: 'white',
                  borderRadius: '10px',
                  border: '2px solid #e67e22'
                }}>
                  <label style={{
                    fontWeight: 'bold',
                    color: '#2c3e50',
                    fontSize: '14px'
                  }}>
                    색상 {index + 4}
                  </label>
                  <div style={{
                    width: '80px',
                    height: '80px',
                    backgroundColor: color,
                    border: '3px solid #333',
                    borderRadius: '10px',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                  }} />
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => {
                      const newColors = [...colors];
                      newColors[index + 3] = e.target.value;
                      setColors(newColors);
                    }}
                    style={{
                      width: '80px',
                      height: '40px',
                      border: '2px solid #333',
                      borderRadius: '5px',
                      cursor: 'pointer'
                    }}
                  />
                  <span style={{
                    fontSize: '11px',
                    fontWeight: 'bold',
                    color: '#7f8c8d',
                    fontFamily: 'monospace'
                  }}>
                    {color.toUpperCase()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div style={{ 
        marginBottom: '20px',
        padding: '25px',
        backgroundColor: 'white',
        borderRadius: '15px',
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
        marginLeft: 'auto',
        marginRight: 'auto'
      }}>
        <h2 style={{
          color: '#2c3e50',
          marginBottom: '20px',
          fontSize: '20px',
          textAlign: 'center',
          borderBottom: '2px solid #3498db',
          paddingBottom: '10px'
        }}>
          ⚙️ 2️⃣ 도안 설정
        </h2>
        
        <div style={{
          display: 'flex', 
          gap: '20px', 
          flexWrap: 'wrap',
          alignItems: 'flex-start',
          justifyContent: 'center'
        }}>
          {/* Upload Section */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            alignItems: 'center',
            padding: '15px',
            backgroundColor: '#e8f5e9',
            borderRadius: '10px',
            minWidth: '200px'
          }}>
            <label style={{ 
              fontWeight: 'bold', 
              color: '#2c3e50',
              fontSize: '14px'
            }}>
              이미지 업로드
            </label>
            <button
              onClick={() => fileInputRef.current.click()}
              style={{
                padding: '12px 24px',
                backgroundColor: '#4CAF50',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '16px',
                fontWeight: 'bold',
                boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                transition: 'all 0.3s'
              }}
            >
              <Upload size={20} />
              이미지 업로드
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              style={{ display: 'none' }}
            />
            <p style={{ 
              fontSize: '11px', 
              color: '#7f8c8d', 
              textAlign: 'center',
              margin: 0
            }}>
              JPG, PNG 등 지원
            </p>
          </div>

          {/* Pixel Size Section */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            alignItems: 'center',
            padding: '15px',
            backgroundColor: '#e3f2fd',
            borderRadius: '10px',
            minWidth: '200px'
          }}>
            <label style={{ 
              fontWeight: 'bold', 
              color: '#2c3e50',
              fontSize: '14px'
            }}>
              픽셀 크기 조절
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button
                onClick={() => setPixelSize(Math.max(10, pixelSize - 5))}
                disabled={useCustomDimensions}
                style={{
                  padding: '10px 18px',
                  backgroundColor: useCustomDimensions ? '#ccc' : '#2196F3',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: useCustomDimensions ? 'not-allowed' : 'pointer',
                  fontSize: '20px',
                  fontWeight: 'bold',
                  boxShadow: useCustomDimensions ? 'none' : '0 2px 4px rgba(0,0,0,0.2)'
                }}
                title="픽셀 크기 감소"
              >
                -
              </button>
              <span style={{ 
                minWidth: '50px', 
                textAlign: 'center',
                fontWeight: 'bold',
                fontSize: '20px',
                color: '#2c3e50'
              }}>
                {pixelSize}
              </span>
              <button
                onClick={() => setPixelSize(Math.min(100, pixelSize + 5))}
                disabled={useCustomDimensions}
                style={{
                  padding: '10px 18px',
                  backgroundColor: useCustomDimensions ? '#ccc' : '#2196F3',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: useCustomDimensions ? 'not-allowed' : 'pointer',
                  fontSize: '20px',
                  fontWeight: 'bold',
                  boxShadow: useCustomDimensions ? 'none' : '0 2px 4px rgba(0,0,0,0.2)'
                }}
                title="픽셀 크기 증가"
              >
                +
              </button>
            </div>
            <p style={{ 
              fontSize: '11px', 
              color: '#7f8c8d', 
              textAlign: 'center',
              margin: 0
            }}>
              비율 유지 모드
            </p>
          </div>

          {/* Custom Dimensions Section */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            alignItems: 'center',
            padding: '15px',
            backgroundColor: '#f3e5f5',
            borderRadius: '10px',
            minWidth: '280px'
          }}>
            <label style={{ 
              fontWeight: 'bold', 
              color: '#2c3e50',
              fontSize: '14px'
            }}>
              픽셀 갯수 조절
            </label>
            
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '10px',
              padding: '8px',
              backgroundColor: 'white',
              borderRadius: '8px',
              border: '2px solid #9C27B0'
            }}>
              <input
                type="checkbox"
                id="customDimensions"
                checked={useCustomDimensions}
                onChange={(e) => setUseCustomDimensions(e.target.checked)}
                style={{
                  width: '20px',
                  height: '20px',
                  cursor: 'pointer'
                }}
              />
              <label 
                htmlFor="customDimensions" 
                style={{ 
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  userSelect: 'none',
                  color: '#2c3e50'
                }}
              >
                직접 입력 모드
              </label>
            </div>

            {useCustomDimensions && (
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px',
                padding: '10px',
                backgroundColor: 'white',
                borderRadius: '8px',
                border: '2px solid #9C27B0'
              }}>
                <label style={{ fontWeight: 'bold', fontSize: '12px', color: '#2c3e50' }}>가로:</label>
                <input
                  type="number"
                  min="10"
                  max="200"
                  value={pixelWidth}
                  onChange={(e) => {
                    const value = e.target.value;
                    // Allow empty string or any number during typing
                    if (value === '') {
                      setPixelWidth('');
                    } else {
                      const numValue = parseInt(value);
                      if (!isNaN(numValue)) {
                        // During typing, allow any value (no min/max enforcement)
                        setPixelWidth(numValue);
                      }
                    }
                  }}
                  onBlur={(e) => {
                    // Only enforce min/max when user finishes editing (on blur)
                    const value = e.target.value;
                    let finalValue;
                    if (value === '' || parseInt(value) < 10) {
                      finalValue = 10;
                      setPixelWidth(10);
                    } else if (parseInt(value) > 200) {
                      finalValue = 200;
                      setPixelWidth(200);
                    } else {
                      finalValue = parseInt(value);
                    }
                    
                    // Check if not a multiple of 3 and show warning
                    if (finalValue % 3 !== 0) {
                      alert('⚠️ 입력한 값이 맞는지 확인해주세요.\n큐브아트의 픽셀수는 보통 3의 배수입니다.\n\n현재 가로: ' + finalValue + '픽셀');
                    }
                  }}
                  onFocus={(e) => {
                    // Select all text on focus for easy editing
                    e.target.select();
                  }}
                  style={{
                    width: '70px',
                    padding: '8px',
                    fontSize: '16px',
                    border: '2px solid #9C27B0',
                    borderRadius: '5px',
                    textAlign: 'center',
                    fontWeight: 'bold'
                  }}
                  title="가로 픽셀 수 (10-200)"
                />
                <span style={{ fontWeight: 'bold', fontSize: '18px', color: '#9C27B0' }}>×</span>
                <label style={{ fontWeight: 'bold', fontSize: '12px', color: '#2c3e50' }}>세로:</label>
                <input
                  type="number"
                  min="10"
                  max="200"
                  value={pixelHeight}
                  onChange={(e) => {
                    const value = e.target.value;
                    // Allow empty string or any number during typing
                    if (value === '') {
                      setPixelHeight('');
                    } else {
                      const numValue = parseInt(value);
                      if (!isNaN(numValue)) {
                        // During typing, allow any value (no min/max enforcement)
                        setPixelHeight(numValue);
                      }
                    }
                  }}
                  onBlur={(e) => {
                    // Only enforce min/max when user finishes editing (on blur)
                    const value = e.target.value;
                    let finalValue;
                    if (value === '' || parseInt(value) < 10) {
                      finalValue = 10;
                      setPixelHeight(10);
                    } else if (parseInt(value) > 200) {
                      finalValue = 200;
                      setPixelHeight(200);
                    } else {
                      finalValue = parseInt(value);
                    }
                    
                    // Check if not a multiple of 3 and show warning
                    if (finalValue % 3 !== 0) {
                      alert('⚠️ 입력한 값이 맞는지 확인해주세요.\n큐브아트의 픽셀수는 보통 3의 배수입니다.\n\n현재 세로: ' + finalValue + '픽셀');
                    }
                  }}
                  onFocus={(e) => {
                    // Select all text on focus for easy editing
                    e.target.select();
                  }}
                  style={{
                    width: '70px',
                    padding: '8px',
                    fontSize: '16px',
                    border: '2px solid #9C27B0',
                    borderRadius: '5px',
                    textAlign: 'center',
                    fontWeight: 'bold'
                  }}
                  title="세로 픽셀 수 (10-200)"
                />
              </div>
            )}
            <p style={{ 
              fontSize: '11px', 
              color: '#7f8c8d', 
              textAlign: 'center',
              margin: 0
            }}>
              {useCustomDimensions ? '자유로운 크기 설정' : '체크박스를 활성화하세요'}
            </p>
          </div>

          {/* Zoom and Download Section */}
          {pixelatedData && (
            <>
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                alignItems: 'center',
                padding: '15px',
                backgroundColor: '#fff3e0',
                borderRadius: '10px',
                minWidth: '200px'
              }}>
                <label style={{ 
                  fontWeight: 'bold', 
                  color: '#2c3e50',
                  fontSize: '14px'
                }}>
                  확대/축소
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <button
                    onClick={() => setZoom(Math.max(0.5, zoom - 0.25))}
                    style={{
                      padding: '10px 16px',
                      backgroundColor: '#FF9800',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      fontWeight: 'bold',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                    }}
                    title="축소"
                  >
                    <ZoomOut size={16} />
                    -
                  </button>
                  <span style={{ 
                    minWidth: '70px', 
                    textAlign: 'center',
                    fontWeight: 'bold',
                    fontSize: '18px',
                    color: '#2c3e50'
                  }}>
                    {(zoom * 100).toFixed(0)}%
                  </span>
                  <button
                    onClick={() => setZoom(Math.min(3, zoom + 0.25))}
                    style={{
                      padding: '10px 16px',
                      backgroundColor: '#FF9800',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      fontWeight: 'bold',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                    }}
                    title="확대"
                  >
                    <ZoomIn size={16} />
                    +
                  </button>
                </div>
                <p style={{ 
                  fontSize: '11px', 
                  color: '#7f8c8d', 
                  textAlign: 'center',
                  margin: 0
                }}>
                  50% ~ 300% 조절
                </p>
              </div>

              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                alignItems: 'center',
                padding: '15px',
                backgroundColor: '#f3e5f5',
                borderRadius: '10px',
                minWidth: '200px'
              }}>
                <label style={{ 
                  fontWeight: 'bold', 
                  color: '#2c3e50',
                  fontSize: '14px'
                }}>
                  저장하기
                </label>
                <button
                  onClick={downloadImage}
                  style={{
                    padding: '12px 24px',
                    backgroundColor: '#9C27B0',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '16px',
                    fontWeight: 'bold',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                    transition: 'all 0.3s'
                  }}
                  title="PNG 파일로 다운로드"
                >
                  <Download size={20} />
                  다운로드
                </button>
                <p style={{ 
                  fontSize: '11px', 
                  color: '#7f8c8d', 
                  textAlign: 'center',
                  margin: 0
                }}>
                  PNG 형식으로 저장
                </p>
              </div>

              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                alignItems: 'center',
                padding: '15px',
                backgroundColor: '#e8f5e9',
                borderRadius: '10px',
                minWidth: '200px'
              }}>
                <label style={{ 
                  fontWeight: 'bold', 
                  color: '#2c3e50',
                  fontSize: '14px'
                }}>
                  📐 큐브 그리드
                </label>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '10px',
                  backgroundColor: 'white',
                  borderRadius: '8px',
                  border: '2px solid #4CAF50'
                }}>
                  <input
                    type="checkbox"
                    id="thickGrid"
                    checked={showThickGrid}
                    onChange={(e) => setShowThickGrid(e.target.checked)}
                    style={{
                      width: '20px',
                      height: '20px',
                      cursor: 'pointer'
                    }}
                  />
                  <label 
                    htmlFor="thickGrid" 
                    style={{ 
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      userSelect: 'none',
                      color: '#2c3e50',
                      fontSize: '14px'
                    }}
                  >
                    3칸마다 진하게
                  </label>
                </div>
                <p style={{ 
                  fontSize: '11px', 
                  color: '#7f8c8d', 
                  textAlign: 'center',
                  margin: 0
                }}>
                  큐브 단위로 구분
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Color Palette */}
      {uploadedImage && (
        <div style={{ 
          marginBottom: '30px',
          padding: '25px',
          backgroundColor: 'white',
          borderRadius: '15px',
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
          marginLeft: 'auto',
          marginRight: 'auto'
        }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: '20px',
            flexWrap: 'wrap',
            gap: '15px'
          }}>
            <h2 style={{ 
              margin: 0, 
              color: '#2c3e50',
              fontSize: '20px',
              borderBottom: '2px solid #e67e22',
              paddingBottom: '5px'
            }}>
              🎨 3️⃣ 색상 팔레트 (6가지 색상)
            </h2>
            {pixelatedData && (
              <div style={{
                padding: '12px 20px',
                backgroundColor: '#3498db',
                color: 'white',
                borderRadius: '8px',
                fontWeight: 'bold',
                fontSize: '16px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
              }}>
                📐 현재 크기: {pixelatedData[0].length} × {pixelatedData.length} 픽셀
              </div>
            )}
          </div>

          {/* Color Mode Toggle */}
          <div style={{
            display: 'flex',
            gap: '10px',
            marginBottom: '20px',
            justifyContent: 'center',
            padding: '15px',
            backgroundColor: '#f8f9fa',
            borderRadius: '10px'
          }}>
            <button
              onClick={() => setColorMode('auto')}
              style={{
                padding: '12px 30px',
                backgroundColor: colorMode === 'auto' ? '#3498db' : '#ecf0f1',
                color: colorMode === 'auto' ? 'white' : '#7f8c8d',
                border: colorMode === 'auto' ? '3px solid #2980b9' : '2px solid #bdc3c7',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '15px',
                fontWeight: 'bold',
                transition: 'all 0.3s',
                boxShadow: colorMode === 'auto' ? '0 4px 8px rgba(0,0,0,0.2)' : 'none'
              }}
            >
              🤖 자동 색상 추출
            </button>
            <button
              onClick={() => setColorMode('manual')}
              style={{
                padding: '12px 30px',
                backgroundColor: colorMode === 'manual' ? '#e67e22' : '#ecf0f1',
                color: colorMode === 'manual' ? 'white' : '#7f8c8d',
                border: colorMode === 'manual' ? '3px solid #d35400' : '2px solid #bdc3c7',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '15px',
                fontWeight: 'bold',
                transition: 'all 0.3s',
                boxShadow: colorMode === 'manual' ? '0 4px 8px rgba(0,0,0,0.2)' : 'none'
              }}
            >
              ✋ 수동 색상 선택
            </button>
          </div>
          
          <div style={{
            padding: '15px',
            backgroundColor: colorMode === 'auto' ? '#e3f2fd' : '#fff3e0',
            borderRadius: '8px',
            marginBottom: '20px',
            border: `2px solid ${colorMode === 'auto' ? '#2196F3' : '#ff9800'}`
          }}>
            <p style={{ 
              margin: 0, 
              color: '#2c3e50', 
              fontSize: '14px',
              lineHeight: '1.6'
            }}>
              {colorMode === 'auto' ? (
                <>
                  <strong>🤖 자동 모드:</strong> 이미지에서 자동으로 6가지 대표 색상을 추출합니다. 
                  추출된 색상은 <strong>컬러 피커</strong>나 <strong>스포이드</strong>로 수정할 수 있습니다.
                </>
              ) : (
                <>
                  <strong>✋ 수동 모드:</strong> 아래에서 원하는 6가지 색상을 직접 선택하세요. 
                  이미지는 선택한 색상만으로 변환됩니다. <strong>이미지 업로드 전에 색상을 미리 설정</strong>할 수 있습니다!
                </>
              )}
            </p>
          </div>
          
          <div style={{ 
            display: 'flex', 
            gap: '20px', 
            flexWrap: 'wrap',
            justifyContent: 'center'
          }}>
            {colors.map((color, index) => (
              <div key={index} style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center',
                gap: '10px',
                padding: '15px',
                backgroundColor: '#f8f9fa',
                borderRadius: '10px',
                border: '2px solid #dee2e6',
                minWidth: '120px'
              }}>
                <div style={{
                  fontSize: '20px',
                  fontWeight: 'bold',
                  color: '#2c3e50'
                }}>
                  색상 {index + 1}
                </div>
                <div style={{
                  width: '90px',
                  height: '90px',
                  backgroundColor: color,
                  border: '4px solid #2c3e50',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  position: 'relative',
                  boxShadow: '0 4px 6px rgba(0,0,0,0.2)',
                  transition: 'transform 0.2s'
                }}
                onClick={() => setActiveColorPicker(activeColorPicker === index ? null : index)}
                onMouseOver={(e) => e.target.style.transform = 'scale(1.05)'}
                onMouseOut={(e) => e.target.style.transform = 'scale(1)'}
                title="클릭하여 색상 선택"
                />
                <input
                  type="color"
                  value={color}
                  onChange={(e) => {
                    const newColors = [...colors];
                    newColors[index] = e.target.value;
                    setColors(newColors);
                  }}
                  style={{
                    width: '90px',
                    height: '35px',
                    border: '3px solid #2c3e50',
                    borderRadius: '8px',
                    cursor: 'pointer'
                  }}
                  title="컬러 피커로 색상 변경"
                />
                <button
                  onClick={() => {
                    setPipetteMode(true);
                    setPipetteColorIndex(index);
                  }}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: isPipetteMode && pipetteColorIndex === index ? '#e74c3c' : '#607D8B',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '13px',
                    fontWeight: 'bold',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                    transition: 'all 0.3s',
                    width: '100%',
                    justifyContent: 'center'
                  }}
                  onMouseOver={(e) => {
                    if (!(isPipetteMode && pipetteColorIndex === index)) {
                      e.target.style.backgroundColor = '#546E7A';
                    }
                  }}
                  onMouseOut={(e) => {
                    if (!(isPipetteMode && pipetteColorIndex === index)) {
                      e.target.style.backgroundColor = '#607D8B';
                    }
                  }}
                  title="도안에서 색상 추출"
                >
                  <Pipette size={16} />
                  스포이드
                </button>
                <div style={{
                  padding: '6px 12px',
                  backgroundColor: '#2c3e50',
                  color: 'white',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  fontFamily: 'monospace'
                }}>
                  {color.toUpperCase()}
                </div>
              </div>
            ))}
          </div>
          {isPipetteMode && (
            <div style={{ 
              marginTop: '20px', 
              textAlign: 'center',
              padding: '15px',
              backgroundColor: '#ffebee',
              borderRadius: '8px',
              border: '2px solid #e74c3c'
            }}>
              <p style={{
                margin: 0,
                color: '#c62828',
                fontWeight: 'bold',
                fontSize: '16px'
              }}>
                👆 스포이드 모드 활성화! 아래 도안에서 원하는 색상을 클릭하세요
              </p>
            </div>
          )}
        </div>
      )}

      {/* Processing Indicator */}
      {isProcessing && (
        <div style={{ 
          textAlign: 'center', 
          padding: '20px',
          fontSize: '18px',
          color: '#2196F3',
          fontWeight: 'bold'
        }}>
          이미지 처리 중...
        </div>
      )}

      {/* Output Canvas */}
      {pixelatedData && (
        <div style={{ 
          marginTop: '30px',
          padding: '25px',
          backgroundColor: 'white',
          borderRadius: '15px',
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
          marginLeft: 'auto',
          marginRight: 'auto'
        }}>
          <h2 style={{
            color: '#2c3e50',
            marginBottom: '20px',
            fontSize: '20px',
            textAlign: 'center',
            borderBottom: '2px solid #27ae60',
            paddingBottom: '10px'
          }}>
            ✨ 생성된 큐브 도안
          </h2>
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            overflow: 'auto',
            padding: '20px',
            backgroundColor: '#f8f9fa',
            borderRadius: '10px'
          }}>
            <div style={{
              transform: `scale(${zoom})`,
              transformOrigin: 'top center',
              transition: 'transform 0.3s ease',
              boxShadow: '0 8px 16px rgba(0,0,0,0.2)'
            }}>
              <canvas
                ref={outputCanvasRef}
                onClick={handleCanvasClick}
                onMouseMove={handleCanvasHover}
                onMouseLeave={handleCanvasLeave}
                style={{
                  border: '4px solid #2c3e50',
                  borderRadius: '8px',
                  cursor: isPipetteMode ? 'crosshair' : 'pointer',
                  imageRendering: 'pixelated',
                  backgroundColor: 'white'
                }}
              />
            </div>
          </div>

          {/* Pixel Info Display */}
          <div style={{
            marginTop: '20px',
            display: 'flex',
            gap: '20px',
            justifyContent: 'center',
            flexWrap: 'wrap'
          }}>
            {/* Hovered Pixel Info */}
            <div style={{
              padding: '15px 25px',
              backgroundColor: hoveredPixel ? '#e3f2fd' : '#f5f5f5',
              borderRadius: '10px',
              border: `3px solid ${hoveredPixel ? '#2196F3' : '#ccc'}`,
              minWidth: '250px',
              transition: 'all 0.3s'
            }}>
              <h4 style={{
                margin: '0 0 10px 0',
                color: '#2c3e50',
                fontSize: '14px',
                textAlign: 'center'
              }}>
                🖱️ 호버 중인 픽셀
              </h4>
              {hoveredPixel ? (
                <div style={{ textAlign: 'center' }}>
                  <p style={{ margin: '5px 0', fontSize: '13px', color: '#555' }}>
                    <strong>좌표:</strong> ({hoveredPixel.x}, {hoveredPixel.y})
                  </p>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '10px',
                    marginTop: '8px'
                  }}>
                    <div style={{
                      width: '40px',
                      height: '40px',
                      backgroundColor: hoveredPixel.color,
                      border: '2px solid #333',
                      borderRadius: '5px'
                    }} />
                    <span style={{
                      fontSize: '13px',
                      fontWeight: 'bold',
                      fontFamily: 'monospace',
                      color: '#2c3e50'
                    }}>
                      {hoveredPixel.color.toUpperCase()}
                    </span>
                  </div>
                </div>
              ) : (
                <p style={{ 
                  margin: 0, 
                  fontSize: '13px', 
                  color: '#999', 
                  textAlign: 'center' 
                }}>
                  픽셀 위에 마우스를 올려보세요
                </p>
              )}
            </div>

            {/* Selected Pixel Info */}
            <div style={{
              padding: '15px 25px',
              backgroundColor: selectedPixel ? '#fff3e0' : '#f5f5f5',
              borderRadius: '10px',
              border: `3px solid ${selectedPixel ? '#ff9800' : '#ccc'}`,
              minWidth: '300px',
              transition: 'all 0.3s'
            }}>
              <h4 style={{
                margin: '0 0 10px 0',
                color: '#2c3e50',
                fontSize: '14px',
                textAlign: 'center'
              }}>
                👆 선택된 픽셀
              </h4>
              {selectedPixel ? (
                <div style={{ textAlign: 'center' }}>
                  <p style={{ margin: '5px 0', fontSize: '13px', color: '#555' }}>
                    <strong>좌표:</strong> ({selectedPixel.x}, {selectedPixel.y})
                  </p>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '10px',
                    marginTop: '8px'
                  }}>
                    <div style={{
                      width: '40px',
                      height: '40px',
                      backgroundColor: selectedPixel.color,
                      border: '2px solid #333',
                      borderRadius: '5px'
                    }} />
                    <span style={{
                      fontSize: '13px',
                      fontWeight: 'bold',
                      fontFamily: 'monospace',
                      color: '#2c3e50'
                    }}>
                      {selectedPixel.color.toUpperCase()}
                    </span>
                  </div>

                  {/* Color Picker */}
                  <div style={{
                    marginTop: '15px',
                    padding: '10px',
                    backgroundColor: '#fef5e7',
                    borderRadius: '8px',
                    border: '2px solid #f39c12'
                  }}>
                    <label style={{
                      display: 'block',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      color: '#2c3e50',
                      marginBottom: '8px'
                    }}>
                      🎨 색상 변경
                    </label>
                    <input
                      type="color"
                      value={selectedPixel.color}
                      onChange={(e) => changePixelColor(e.target.value)}
                      style={{
                        width: '100%',
                        height: '40px',
                        border: '2px solid #333',
                        borderRadius: '5px',
                        cursor: 'pointer'
                      }}
                    />
                  </div>

                  {/* Quick Color Buttons */}
                  <div style={{
                    marginTop: '10px',
                    padding: '10px',
                    backgroundColor: '#e8f5e9',
                    borderRadius: '8px',
                    border: '2px solid #4CAF50'
                  }}>
                    <label style={{
                      display: 'block',
                      fontSize: '11px',
                      fontWeight: 'bold',
                      color: '#2c3e50',
                      marginBottom: '8px',
                      textAlign: 'center'
                    }}>
                      ⚡ 빠른 색상 선택
                    </label>
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(6, 1fr)',
                      gap: '5px'
                    }}>
                      {colors.map((color, index) => (
                        <button
                          key={index}
                          onClick={() => changePixelColor(color)}
                          style={{
                            width: '35px',
                            height: '35px',
                            backgroundColor: color,
                            border: selectedPixel.color === color ? '3px solid #000' : '2px solid #666',
                            borderRadius: '5px',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            boxShadow: selectedPixel.color === color ? '0 2px 8px rgba(0,0,0,0.4)' : 'none'
                          }}
                          title={`색상 ${index + 1}: ${color}`}
                        />
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={() => setSelectedPixel(null)}
                    style={{
                      marginTop: '10px',
                      padding: '8px 20px',
                      backgroundColor: '#e74c3c',
                      color: 'white',
                      border: 'none',
                      borderRadius: '5px',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: 'bold'
                    }}
                  >
                    ❌ 선택 해제
                  </button>
                </div>
              ) : (
                <p style={{ 
                  margin: 0, 
                  fontSize: '13px', 
                  color: '#999', 
                  textAlign: 'center' 
                }}>
                  픽셀을 클릭해보세요
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Hidden canvas for processing */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {/* Instructions */}
      {!uploadedImage && (
        <div style={{
          maxWidth: '800px',
          textAlign: 'center',
          padding: '60px 40px',
          backgroundColor: 'white',
          borderRadius: '15px',
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
          border: '3px dashed #3498db',
          marginLeft: 'auto',
          marginRight: 'auto'
        }}>
          <div style={{ fontSize: '80px', marginBottom: '20px' }}>🎨</div>
          <p style={{ 
            marginBottom: '15px', 
            fontSize: '24px',
            color: '#2c3e50',
            fontWeight: 'bold'
          }}>
            이미지를 업로드하여 큐브 도안을 생성하세요!
          </p>
          <p style={{
            margin: 0,
            fontSize: '16px',
            color: '#7f8c8d',
            lineHeight: '1.6'
          }}>
            업로드한 이미지가 자동으로 6가지 색상의 픽셀 아트로 변환됩니다<br/>
            크로스스티치나 큐브 공예에 바로 활용할 수 있습니다
          </p>
          <div style={{
            marginTop: '30px',
            padding: '20px',
            backgroundColor: '#e8f4f8',
            borderRadius: '10px',
            display: 'inline-block'
          }}>
            <p style={{
              margin: 0,
              fontSize: '14px',
              color: '#2c3e50'
            }}>
              <strong>💡 추천 이미지:</strong> 단순한 형태, 명확한 색상 대비가 있는 이미지가 좋은 결과를 만듭니다
            </p>
          </div>
        </div>
      )}
      </div>
    </div>
  );
};

export default CubePatternGenerator;
