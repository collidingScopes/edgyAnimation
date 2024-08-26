/*To do:
Add wavy wind trails into the animation?
Fix angle functionality -- currently in reverse at some quadrants
Add option for subtle color variation
Add to GUI: animation speed, pixel size, color variation style, key pixels per frame
Bound the color variation by master hue / range? --add menu toggle option
Press i to randomize gui inputs
Randomize the smear width -- too uniform currently
Resize input image to max 1080 width before analysing key pixels?
Oscillate between drawing noise/edge color and background color (cycle switch every x frames)
*/

var canvas = document.getElementById("canvas");
var ctx = canvas.getContext("2d");

var animationSpeed;
var animationRequest;
var playAnimationToggle = false;

var imageInput = document.getElementById('imageInput');
var imageContainer = document.getElementById('imageContainer');

var loadingScreen = document.getElementById("coverScreen");

var pixelColors = document.getElementById('pixelColors');
var newImageContainer = document.getElementById('newImageContainer');
var originalImage;

var isImageLoaded = false;

var screenWidth = window.innerWidth; // get the width of the browser screen
var maxImageWidth = (screenWidth*0.96) / 2; // max width for each of the two images
var maxImageHeight = window.innerHeight * 0.78;
console.log("max image dimensions: "+maxImageWidth+", "+maxImageHeight);

var actualWidth;
var actualHeight;
var scaledWidth;
var scaledHeight;
var widthScalingRatio;

var newCanvas = document.createElement('canvas');
var newCtx = newCanvas.getContext('2d');

var pixelData;
var pixels;

var keyPixelArray = [];

//detect user browser
var ua = navigator.userAgent;
var isSafari = false;
var isFirefox = false;
var isIOS = false;
var isAndroid = false;
if(ua.includes("Safari")){
    isSafari = true;
}
if(ua.includes("Firefox")){
    isFirefox = true;
}
if(ua.includes("iPhone") || ua.includes("iPad") || ua.includes("iPod")){
    isIOS = true;
}
if(ua.includes("Android")){
    isAndroid = true;
}
console.log("isSafari: "+isSafari+", isFirefox: "+isFirefox+", isIOS: "+isIOS+", isAndroid: "+isAndroid);

var mediaRecorder;
var recordedChunks;
var finishedBlob;
var recordingMessageDiv = document.getElementById("videoRecordingMessageDiv");
var recordVideoState = false;
var videoRecordInterval;
var videoEncoder;
var muxer;
var mobileRecorder;
var videofps = 30;

//add gui
var obj = {
    backgroundColor: "#000000",
    noiseColor: "#0011FF",
    edgeColor: "#ffffff",
    edgeSensitivity: 75,
    maxSmear: 35,
    randomDots: 70,
    noiseOpacity: 80,
    power: 15,
    angle: 0,
    pixelsPerFrame: 100,
};

var xSlope;
var ySlope;

var gui = new dat.gui.GUI( { autoPlace: false } );
//gui.close();
var guiOpenToggle = true;

obj['importImage'] = function () {
imageInput.click();
};
gui.add(obj, 'importImage').name("Import Image");

gui.addColor(obj, "backgroundColor").name("Background Color")
gui.addColor(obj, "noiseColor").name("Noise Color")
gui.addColor(obj, "edgeColor").name("Edge Color")
gui.add(obj, "edgeSensitivity").min(1).max(100).step(1).name('Edge Sensitivity').onFinishChange(analyseImage);
gui.add(obj, "maxSmear").min(1).max(100).step(1).name('Smear Width')
gui.add(obj, "randomDots").min(1).max(100).step(1).name('# Random Dots')
gui.add(obj, "noiseOpacity").min(1).max(100).step(1).name('Dot Opacity')
gui.add(obj, "power").min(1).max(50).step(1).name('Cluster Power')
gui.add(obj, "angle").min(0).max(360).step(1).name('Angle').onFinishChange(calculateSlopes)
gui.add(obj, "pixelsPerFrame").min(1).max(1000).step(1).name('Key Px Per Frame')

obj['playAnimation'] = function () {
    pausePlayAnimation();
};
gui.add(obj, 'playAnimation').name("Play/Pause Animation (p)");

obj['refreshCanvas'] = function () {
    refreshCanvas();
};
gui.add(obj, 'refreshCanvas').name("Refresh Canvas (r)");

obj['saveImage'] = function () {
saveImage();
};
gui.add(obj, 'saveImage').name("Save Image (s)");

obj['saveVideo'] = function () {
toggleVideoRecord();
};
gui.add(obj, 'saveVideo').name("Video Export (v)");

customContainer = document.getElementById( 'gui' );
customContainer.appendChild(gui.domElement);

// Add event listeners to the input boxes
imageInput.addEventListener('change', readSourceImage);

function readSourceImage(){

//remove any existing images
while (imageContainer.firstChild) {
    imageContainer.removeChild(imageContainer.firstChild);
}

while (newImageContainer.firstChild) {
    newImageContainer.removeChild(newImageContainer.firstChild);
}

//read image file      
  var file = imageInput.files[0];
  var reader = new FileReader();
  reader.onload = (event) => {
    var imageData = event.target.result;
    var image = new Image();
    image.src = imageData;
    image.onload = () => {
      
        actualWidth = image.width;
        actualHeight = image.height;
            
        //adjust for max width
        if(actualWidth >= maxImageWidth){
            scaledWidth = maxImageWidth;
        } else{
            scaledWidth = Math.min(maxImageWidth,actualWidth*2);
        }

        widthScalingRatio = scaledWidth / actualWidth;
        scaledHeight = actualHeight * widthScalingRatio;

        //adjust for max height
        if(scaledHeight > maxImageHeight){
            scaledWidth = (maxImageHeight / scaledHeight) * scaledWidth;
            widthScalingRatio = scaledWidth / actualWidth;
            scaledHeight = actualHeight * widthScalingRatio;
        }

        var originalImg = document.createElement('img');
        originalImg.src = imageData;
        originalImg.width = scaledWidth;
        originalImg.height = scaledHeight;
        imageContainer.appendChild(originalImg);

        // Get the pixel colors
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = actualWidth;
        canvas.height = actualHeight;
        ctx.drawImage(image, 0, 0);
        pixelData = ctx.getImageData(0, 0, actualWidth, actualHeight);
        pixels = pixelData.data;

        analyseImage();

    };
  };
  reader.readAsDataURL(file);
  isImageLoaded = true;

}

function refreshCanvas(){

    console.log("refresh");

    if(playAnimationToggle==true){
        playAnimationToggle = false;
        cancelAnimationFrame(animationRequest);
        console.log("cancel animation");
    }//cancel any existing animation loops

    playAnimationToggle = true;

    canvas.width = actualWidth;
    canvas.height = actualHeight;

    canvas.scrollIntoView({behavior:"smooth"});

    ctx.fillStyle = obj.backgroundColor;
    ctx.fillRect(0,0,actualWidth,actualHeight);

    startAnimation();

}

function analyseImage(){

    //remove any existing new images
    while (newImageContainer.firstChild) {
        newImageContainer.removeChild(newImageContainer.firstChild);
    }

    lightDataArray = [];
    smoothedLightDataArray = [];
    keyPixelArray = [];
    var lightDataArray = [];

    //generate data array for all pixel lightness values
    for(var y=0; y < actualHeight; y++ ){

        lightDataArray[y] = [];

        for(var x=0; x < actualWidth; x++ ){

            var actualPixel = (y * actualWidth + x) * 4;
            var actualRed = pixels[actualPixel];
            var actualGreen = pixels[actualPixel + 1];
            var actualBlue = pixels[actualPixel + 2];
            var actualLum = (0.2989 * actualRed + 0.5870 * actualGreen + 0.1140 * actualBlue)/255;

            lightDataArray[y][x] = actualLum;

        }
    }

    console.log("lightness data array filled");

    //gaussian smoothing function
    var smoothedLightDataArray = []
    var kernelWidth = 5;
    var kernelHeight = kernelWidth;
    var middlePixel = Math.floor(kernelWidth/2);
    var kernelWeights = [0.003663004, 0.014652015, 0.025641026, 0.014652015, 0.003663004, 0.014652015, 0.058608059, 0.095238095, 0.058608059, 0.014652015, 0.025641026, 0.095238095, 0.15018315, 0.095238095, 0.025641026, 0.014652015, 0.058608059, 0.095238095, 0.058608059, 0.014652015, 0.003663004, 0.014652015, 0.025641026, 0.014652015, 0.003663004];

    var threshold = 0.165 - (obj.edgeSensitivity/100 * 0.16);

    for(var y=0; y < actualHeight; y++ ){
        smoothedLightDataArray[y] = [];

        for(var x=0; x < actualWidth; x++ ){
            
            var kernelData = [];

            for(var kernelY=0; kernelY<kernelHeight; kernelY++){
                for(var kernelX=0; kernelX<kernelWidth; kernelX++){
                    var pixelXPosition = x + (kernelX-middlePixel);
                    var pixelYPosition = y + (kernelY-middlePixel);
                    if(pixelXPosition >= 0 && pixelXPosition < actualWidth && pixelYPosition >= 0 && pixelYPosition < actualHeight){
                        kernelData.push(lightDataArray[pixelYPosition][pixelXPosition]);
                    }else{
                        kernelData.push(0);
                    }
                }
            }

            var weightedAverageLight = calcWeightedAverage(kernelData,kernelWeights);
            smoothedLightDataArray[y][x] = weightedAverageLight;

            if(x==0 || y==0 || x==actualWidth-1 || y==actualHeight-1){
                continue;
            }

            var lightValue = smoothedLightDataArray[y][x];
            
            var leftLight = smoothedLightDataArray[y][x-1];
            var topLight = smoothedLightDataArray[y-1][x];
            
            var delta1 = Math.abs(lightValue - leftLight);
            var delta2 = Math.abs(lightValue - topLight);

            if(delta1 > threshold || delta2 > threshold){
                var keyPixel = [x, y];
                keyPixelArray.push(keyPixel);
            }

        }
    }

    console.log("# key pixels: "+keyPixelArray.length);
    //drawPixels();
    refreshCanvas();
    
}

function pausePlayAnimation(){
    console.log("pause/play animation");
    if(playAnimationToggle==true){
        playAnimationToggle = false;
        cancelAnimationFrame(animationRequest);
        console.log("cancel animation");
    } else {
        startAnimation();
    }
}

function startAnimation(){
    
    console.log("start generative animation");
    playAnimationToggle = true;
    var threshold = 0;
    animationSpeed = 5; //larger values give slower animation
    var counter = 0;
    var pixelWidth = 2;
    var pixelHeight = 2;
    calculateSlopes();

    animationRequest = requestAnimationFrame(loop);
    function loop(){

        //threshold = Math.min(0.6, (Math.sin(counter/animationSpeed)+1)/2) - 0.25 + Math.random()*0.5;
        
        //select key pixels
        for(var i=0; i<obj.pixelsPerFrame; i++){
            
            var randomPixel;
            /*
            if(i==0){
                randomPixel = Math.floor(Math.random() * (keyPixelArray.length-1));
            } else {
                randomPixel = Math.min(keyPixelArray.length-1,randomPixel+1);
            }
            */
            randomPixel = Math.floor(Math.random() * (keyPixelArray.length-1));
            var x = keyPixelArray[randomPixel][0];
            var y = keyPixelArray[randomPixel][1];

            //var smearWidth = (obj.maxSmear/100 * actualWidth) * ( (Math.sin(counter/animationSpeed)+1)/2);
            //var smearWidth = (obj.maxSmear/100 * actualWidth);
            var smearWidth = (obj.maxSmear/100 * actualWidth) * ( (Math.sin(counter/600)+2)/2);
            //var waveAmplitude = actualHeight*0.06 * Math.random();

            for(var j=0; j<obj.randomDots; j++){
                //draw noise dots

                /*
                if(threshold > 0.5){
                    //ctx.fillStyle = obj.noiseColor;
                    ctx.fillStyle = "hsl("+(counter/animationSpeed%360)+","+Math.random()*100+"%,"+Math.random()*100+"%)";
                } else {
                    ctx.fillStyle = obj.backgroundColor;
                }
                */
               if(Math.floor(counter/100) == 0 || Math.floor(counter/100)%5 == 0){
                    //ctx.fillStyle = "hsl("+(counter*2/animationSpeed%360)+","+Math.random()*100+"%,"+Math.random()*100+"%)";
                    //ctx.fillStyle = obj.noiseColor;
                    ctx.fillStyle = "hsl("+(counter*2/animationSpeed%360)+",80%,50%)";
                    ctx.globalAlpha = obj.noiseOpacity/100;
                } else {
                    ctx.fillStyle = obj.backgroundColor;
                    ctx.globalAlpha = 1;
                }

                //ctx.fillStyle = "hsl("+(counter*2/animationSpeed%360)+","+Math.random()*100+"%,"+Math.random()*100+"%)";
                //ctx.globalAlpha = obj.noiseOpacity/100;
                
                var currentShift = Math.pow(Math.random(),obj.power) * smearWidth;
                //var shiftRatio = currentShift / smearWidth; 
                var newX = x + currentShift * xSlope;
                //var newY = (y - (currentShift * ySlope))  + (waveAmplitude * Math.sin(shiftRatio * Math.PI*8)); // y=0 starts at the top of the image
                var newY = (y - (currentShift * ySlope)); // y=0 starts at the top of the image
                ctx.fillRect(newX,newY,1,1);

            }

            //draw edge

            if(Math.floor(counter/100)%2 == 0){
                ctx.fillStyle = obj.edgeColor;
            } else {
                //ctx.fillStyle = obj.backgroundColor;
                //ctx.fillStyle = "red";
                ctx.fillStyle = "hsl("+(counter*2/animationSpeed%360)+",80%,50%)";
            }

            //ctx.fillStyle = obj.edgeColor;
            ctx.globalAlpha = 1;
            ctx.fillRect(x,y,pixelWidth,pixelHeight);

        }

        counter++;
        animationRequest = requestAnimationFrame(loop);
    }

}

//Helper Functions

function calculateSlopes(){
    if(obj.angle == 0 || obj.angle == 360){
        xSlope = 1;
        ySlope = 0;
    } else if(obj.angle == 90){
        xSlope = 0;
        ySlope = 1;
    } else if(obj.angle == 180){
        xSlope = -1;
        ySlope = 0;
    } else if(obj.angle == 270) {
        xSlope = 0;
        ySlope = -1;
    } else {
        var slope = angleToSlope(obj.angle);
        xSlope = slope.x;
        ySlope = slope.y;
    }
}

function angleToSlope(angle) {
    const radians = angle * Math.PI / 180;
    const slope = Math.tan(radians);
    return { x: 1, y: slope };
}

function angleToSlopeXY(angle) {
    const slope = angleToSlope(angle);
    return { x: slope.x, y: slope.y };
}

function saveImage(){
    const link = document.createElement('a');
    link.href = canvas.toDataURL();
  
    const date = new Date();
    const filename = `edgy_${date.toLocaleDateString()}_${date.toLocaleTimeString()}.png`;
    link.download = filename;
    link.click();
}

function hexToRgb(hex) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return { r, g, b };
}

function tweakHexColor(hexColor, range){
    var rgbArray = hexToRgb(hexColor);

    var newRGBArray = [];

    newRGBArray.push(Math.floor(rgbArray[0]+range*Math.random()-range/2));
    newRGBArray.push(Math.floor(rgbArray[1]+range*Math.random()-range/2));
    newRGBArray.push(Math.floor(rgbArray[2]+range*Math.random()-range/2));

    var newHexColor = rgbToHex(newRGBArray[0],newRGBArray[1],newRGBArray[2]);
    return newHexColor;
}

function getHueFromHex(hex) {
    const rgb = hexToRgb(hex);
    const r = rgb.r / 255;
    const g = rgb.g / 255;
    const b = rgb.b / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;

    let hue = 0;

    if (delta === 0) {
        hue = 0;
    } else if (max === r) {
        hue = (g - b) / delta;
    } else if (max === g) {
        hue = 2 + (b - r) / delta;
    } else {
        hue = 4 + (r - g) / delta;
    }

    hue *= 60;
    if (hue < 0) {
        hue += 360;
    }

    return hue;
}

function rgbToHue(r, g, b) {
    const rNorm = r / 255;
    const gNorm = g / 255;
    const bNorm = b / 255;
    const hue = Math.atan2(Math.sqrt(3) * (gNorm - bNorm), 2 * rNorm - gNorm - bNorm);
    return hue * 180 / Math.PI;
    }

function rgbToSaturation(r, g, b) {
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    return (max - min) / max;
}

function rgbToLightness(r, g, b) {
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    return (max + min) / 2 / 255;
}

function interpolateHex(hex1,hex2,factor){
    hex1RGB = hexToRgb(hex1);
    hex2RGB = hexToRgb(hex2);

    var newR = Math.round(hex1RGB.r + (hex2RGB.r - hex1RGB.r)*factor);
    var newG = Math.round(hex1RGB.g + (hex2RGB.g - hex1RGB.g)*factor);
    var newB = Math.round(hex1RGB.b + (hex2RGB.b - hex1RGB.b)*factor);

    var rgbResult = "rgb("+newR+","+newG+","+newB+")";
    return rgbResult;
}

function rgbToHex(r, g, b) {
    return "#" + (
        (r.toString(16).padStart(2, "0")) +
        (g.toString(16).padStart(2, "0")) +
        (b.toString(16).padStart(2, "0"))
    );
}

function toggleGUI(){
    if(guiOpenToggle == false){
        gui.open();
        guiOpenToggle = true;
    } else {
        gui.close();
        guiOpenToggle = false;
    }
}

//shortcut hotkey presses
document.addEventListener('keydown', function(event) {

    if (event.key === 'r') {
        refreshCanvas();
    } else if (event.key === 's') {
        saveImage();
    } else if (event.key === 'v') {
        toggleVideoRecord();
    } else if (event.key === 'o') {
        toggleGUI();
    } else if(event.key === 'p'){
        pausePlayAnimation();
    }

});
  

function calcWeightedAverage(data,weights){
    var weightedAverage = 0;
    for(var i=0; i<data.length; i++){
        weightedAverage += data[i]*weights[i];
    }
    return weightedAverage;
}

function getAverageColor(chosenPixels) {
    var r = 0;
    var g = 0;
    var b = 0;
    var count = chosenPixels.length / 4;
    for (let i = 0; i < count; i++) {
        r += chosenPixels[i * 4];
        g += chosenPixels[i * 4 + 1];
        b += chosenPixels[i * 4 + 2];
    }
    return [r / count, g / count, b / count];
}

function resizeTable(){
    const table = document.getElementById('imageTable'); 
    // set the width of each column
    table.getElementsByTagName('td')[0].style.width = `${scaledWidth}px`;
    table.getElementsByTagName('td')[1].style.width = `${scaledWidth}px`;
}

function toggleVideoRecord(){
    if(recordVideoState == false){
      recordVideoState = true;
      chooseRecordingFunction();
    } else {
      recordVideoState = false;
      chooseEndRecordingFunction();
    }
}
  
function chooseRecordingFunction(){
    if(isIOS || isAndroid || isFirefox){
        startMobileRecording();
    }else {
        recordVideoMuxer();
    }
}
  
function chooseEndRecordingFunction(){
        
    if(isIOS || isAndroid || isFirefox){
        mobileRecorder.stop();
    }else {
        finalizeVideo();
    }
    
}
  
//record html canvas element and export as mp4 video
//source: https://devtails.xyz/adam/how-to-save-html-canvas-to-mp4-using-web-codecs-api
async function recordVideoMuxer() {
    console.log("start muxer video recording");
    var videoWidth = Math.floor(canvas.width/2)*2;
    var videoHeight = Math.floor(canvas.height/8)*8; //force a number which is divisible by 8
    console.log("Video dimensions: "+videoWidth+", "+videoHeight);
  
    //display user message
    recordingMessageDiv.classList.remove("hidden");
  
    recordVideoState = true;
    const ctx = canvas.getContext("2d", {
      // This forces the use of a software (instead of hardware accelerated) 2D canvas
      // This isn't necessary, but produces quicker results
      willReadFrequently: true,
      // Desynchronizes the canvas paint cycle from the event loop
      // Should be less necessary with OffscreenCanvas, but with a real canvas you will want this
      desynchronized: true,
    });
  
    muxer = new Mp4Muxer.Muxer({
        target: new Mp4Muxer.ArrayBufferTarget(),
        video: {
            // If you change this, make sure to change the VideoEncoder codec as well
            codec: "avc",
            width: videoWidth,
            height: videoHeight,
        },
  
        firstTimestampBehavior: 'offset', 
  
      // mp4-muxer docs claim you should always use this with ArrayBufferTarget
      fastStart: "in-memory",
    });
  
    videoEncoder = new VideoEncoder({
      output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
      error: (e) => console.error(e),
    });
  
    // This codec should work in most browsers
    // See https://dmnsgn.github.io/media-codecs for list of codecs and see if your browser supports
    videoEncoder.configure({
      codec: "avc1.42003e",
      width: videoWidth,
      height: videoHeight,
      bitrate: 6_000_000,
      bitrateMode: "constant",
    });
    //NEW codec: "avc1.42003e",
    //ORIGINAL codec: "avc1.42001f",
  
    refreshCanvas();
    var frameNumber = 0;
    //setTimeout(finalizeVideo,1000*videoDuration+200); //finish and export video after x seconds
  
    //take a snapshot of the canvas every x miliseconds and encode to video
    videoRecordInterval = setInterval(
        function(){
            if(recordVideoState == true){
                renderCanvasToVideoFrameAndEncode({
                    canvas,
                    videoEncoder,
                    frameNumber,
                    videofps
                })
                frameNumber++;
            }else{
            }
        } , 1000/videofps);
  
}
  
//finish and export video
async function finalizeVideo(){
    console.log("finalize muxer video");
    clearInterval(videoRecordInterval);
    //playAnimationToggle = false;
    recordVideoState = false;
    
    // Forces all pending encodes to complete
    await videoEncoder.flush();
    muxer.finalize();
    let buffer = muxer.target.buffer;
    finishedBlob = new Blob([buffer]); 
    downloadBlob(new Blob([buffer]));
  
    //hide user message
    recordingMessageDiv.classList.add("hidden");
    
}
  
async function renderCanvasToVideoFrameAndEncode({
    canvas,
    videoEncoder,
    frameNumber,
    videofps,
  }) {
    let frame = new VideoFrame(canvas, {
        // Equally spaces frames out depending on frames per second
        timestamp: (frameNumber * 1e6) / videofps,
    });
  
    // The encode() method of the VideoEncoder interface asynchronously encodes a VideoFrame
    videoEncoder.encode(frame);
  
    // The close() method of the VideoFrame interface clears all states and releases the reference to the media resource.
    frame.close();
}
  
function downloadBlob() {
    console.log("download video");
    let url = window.URL.createObjectURL(finishedBlob);
    let a = document.createElement("a");
    a.style.display = "none";
    a.href = url;
    const date = new Date();
    const filename = `edgy_${date.toLocaleDateString()}_${date.toLocaleTimeString()}.mp4`;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
}
  
//record and download videos on mobile devices
function startMobileRecording(){
    var stream = canvas.captureStream(videofps);
    mobileRecorder = new MediaRecorder(stream, { 'type': 'video/mp4' });
    mobileRecorder.addEventListener('dataavailable', finalizeMobileVideo);
  
    console.log("start simple video recording");
    console.log("Video dimensions: "+canvas.width+", "+canvas.height);
  
    //display user message
    //recordingMessageCountdown(videoDuration);
    recordingMessageDiv.classList.remove("hidden");
    
    recordVideoState = true;
    mobileRecorder.start(); //start mobile video recording
  
    /*
    setTimeout(function() {
        recorder.stop();
    }, 1000*videoDuration+200);
    */
}
  
function finalizeMobileVideo(e) {
    setTimeout(function(){
        console.log("finish simple video recording");
        recordVideoState = false;
        /*
        mobileRecorder.stop();*/
        var videoData = [ e.data ];
        finishedBlob = new Blob(videoData, { 'type': 'video/mp4' });
        downloadBlob(finishedBlob);
        
        //hide user message
        recordingMessageDiv.classList.add("hidden");
  
    },500);
  
}

function randomWithinRange(value,range){
    return value-range+Math.random()*range*2;
}
  



/*

function drawPixels(){
    console.log("start to draw new image");

    //remove any existing new images
    while (newImageContainer.firstChild) {
        newImageContainer.removeChild(newImageContainer.firstChild);
    }

    // Create a new image
    newCanvas = document.createElement('canvas');
    newCtx = newCanvas.getContext('2d');

    newCanvas.width = actualWidth;
    newCanvas.height = actualHeight;

    //set background color of new canvas
    newCtx.fillStyle = obj.backgroundColor;
    newCtx.globalAlpha = 1;
    newCtx.fillRect(0, 0, actualWidth, actualHeight);

    console.log("actual width: "+actualWidth);
    console.log("actual height: "+actualHeight);

    var alpha = 1;
    var pixelWidth = 2;
    var pixelHeight = 2;

    if(obj.angle == 0 || obj.angle == 360){
        xSlope = 1;
        ySlope = 0;
    } else if(obj.angle == 90){
        xSlope = 0;
        ySlope = 1;
    } else if(obj.angle == 180){
        xSlope = -1;
        ySlope = 0;
    } else if(obj.angle == 270) {
        xSlope = 0;
        ySlope = -1;
    } else {
        var slope = angleToSlope(obj.angle);
        xSlope = slope.x;
        ySlope = slope.y;
    }

    for(i=0; i<keyPixelArray.length; i++){

        var x = keyPixelArray[i][0];
        var y = keyPixelArray[i][1];

        var currentNumDots = obj.randomDots * Math.random();

        for(var j=0; j<currentNumDots; j++){
            newCtx.fillStyle = obj.noiseColor;
            newCtx.globalAlpha = obj.noiseOpacity/100;
            var currentShift = Math.pow(Math.random(),obj.power) * (obj.maxSmear/100 * actualWidth); 
            var newX = x + currentShift * xSlope;
            var newY = y - currentShift * ySlope; // y=0 starts at the top of the image
            newCtx.fillRect(newX,newY,1,1);
        }

        newCtx.fillStyle = obj.edgeColor;
        newCtx.globalAlpha = 1;
        newCtx.fillRect(x,y,pixelWidth,pixelHeight);

    }

    const newImageData = newCanvas.toDataURL();
    const newImage = new Image();
    newImage.src = newImageData;
    newImage.style.width = `${scaledWidth}px`;
    newImageContainer.appendChild(newImage);

    resizeTable();

}
*/