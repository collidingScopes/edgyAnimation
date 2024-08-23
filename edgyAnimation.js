/*To do:
Modularize inputs -- blue color, single color for edge detection, # dots, angle, etc...
Function to analyse pixels / save key pixels separately (most inputs don't need to call this again)
Animation -- scattering of the random dots in sine waves (back and forth), or left to right?
Draw onto new canvas rather than onto new image (just do one less step?)
Add loading lock on screen while image is processing
Simplify old code (remove toggle input menu, old menu table, color palette functions, etc...)
Implement angle functionality -- currently in reverse at some quadrants
*/

var imageInput = document.getElementById('imageInput');
var imageContainer = document.getElementById('imageContainer');
var pixelColors = document.getElementById('pixelColors');
var newImageContainer = document.getElementById('newImageContainer');
var originalImage;
var clickXPosition;
var clickYPosition;
var visualizationChoiceMenu = document.getElementById('visualizationChoice');
var visualizationChoice = visualizationChoiceMenu.value;
var previousVisualizationChoice = visualizationChoice;
var loadingScreen = document.getElementById("coverScreen");

var redInput = document.getElementById('red');
var greenInput = document.getElementById('green');
var blueInput = document.getElementById('blue');
var alphaInput = document.getElementById('alpha');

var smearWidthInput = document.getElementById('smearWidth');
var smearWidth = smearWidthInput.value;
var chosenPixelInput = document.getElementById('chosenPixel');
var chosenPixel = chosenPixelInput.value;

var noiseProbabilityInput = document.getElementById('noiseProbability');
var noiseProbability = noiseProbabilityInput.value;

var noiseColorRangeInput = document.getElementById('noiseColorRange');
var noiseColorRange = noiseColorRangeInput.value;
var rgbColorRange = noiseColorRange/100 * 255;

var dotSizeFactorInput = document.getElementById('dotSizeFactor');
var dotSizeFactor = dotSizeFactorInput.value;

var lightnessLevelInput = document.getElementById('lightnessLevel');
var lightnessLevel = lightnessLevelInput.value;

var saturationLevelInput = document.getElementById('saturationLevel');
var saturationLevel = saturationLevelInput.value;

var isImageLoaded = false;

var redrawButton = document.getElementById('generate-button');
redrawButton.addEventListener('click', refresh);

var actualWidth;
var actualHeight;
var scaledWidth;
var scaledHeight;
var widthScalingRatio;

var newCanvas = document.createElement('canvas');
var newCtx = newCanvas.getContext('2d');

var pixelData;
var pixels;

var redShift = redInput.value;
var greenShift = greenInput.value;
var blueShift = blueInput.value;
var alphaShift = alphaInput.value;

var screenWidth = window.innerWidth; // get the width of the browser screen
var maxImageWidth = (screenWidth*0.96) / 2; // max width for each of the two images
var maxImageHeight = window.innerHeight * 0.78;
console.log("max image dimensions: "+maxImageWidth+", "+maxImageHeight);

//color pickers
var paletteChoiceInput = document.getElementById('paletteChoice');
var colorPicker = document.getElementById('color-picker');
var colorPicker2 = document.getElementById('color-picker2');
var colorPicker3 = document.getElementById('color-picker3');
var colorPicker4 = document.getElementById('color-picker4');
var colorPicker5 = document.getElementById('color-picker5');
var colorPicker6 = document.getElementById('color-picker6');
var pickers = [colorPicker, colorPicker2, colorPicker3, colorPicker4, colorPicker5, colorPicker6];

var backgroundColorInput = document.getElementById('backgroundColorInput');
var backgroundColor = backgroundColorInput.value;

var palettePresets = [
    {name: "mage", displayName: "Mage", palette: ["#0066A4","#640000","#006400","#FFC300","#FFFFFF","#000000"]},
    {name: "viridis", displayName: "Viridis", palette: ["#fde725","#7ad151","#22a884","#2a788e","#414487","#440154"]},
    {name: "analog", displayName: "Analog", palette: ["#d27575","#675a55","#529b9c","#9cba8f","#eac392","#FFFFFF"]},
    {name: "inferno", displayName: "Inferno", palette: ["#fcffa4","#fca50a","#dd513a","#932667","#420a68","#000004"]},
    {name: "vaporwave", displayName: "Vaporwave", palette: ["#D336BE","#E1A5EE","#05C3DD","#1E22AA","#D1EFED","#FFFFFF"]},
    {name: "bohemian", displayName: "Bohemian", palette: ["#3F2021","#B04A5A","#BA5B3F","#CB9576","#7FA0AC","#EEE5D3"]},
    {name: "earth", displayName: "Earth", palette: ["#8e412e","#ba6f4d","#e6cebc","#a2a182","#687259","#123524"]},
    {name: "primary", displayName: "Primary", palette: ["#c90000","#fff400","#0004ff","#ffffff","#ffffff","#000000"]},
    {name: "custom", displayName: "Custom >>", palette: ["#FFFFFF","#DDDDDD","#BBBBBB","#000000","#000000","#000000"]}
];

var chosenPalette = palettePresets[0].palette;

//set as equal to mage palette upon first load, in RGB space
var chosenPaletteRGBValues = [
    [0, 102, 164],
    [100, 0, 0],
    [0, 100, 0],
    [255, 195, 0],
    [255, 255, 255],
    [0, 0, 0]
];

//fill the paletteChoice HTML element dynamically
palettePresets.forEach((preset) => {
    const option = document.createElement('option');
    option.value = preset.name;
    option.text = preset.displayName;
    paletteChoiceInput.appendChild(option);
});

var paletteChoice = paletteChoiceInput.value;

//dual color picker
var dualColorPicker1 = document.getElementById('dualColorInput1');
var dualColorPicker2 = document.getElementById('dualColorInput2');

var dualColor1 = dualColorPicker1.value;
var dualColor2 = dualColorPicker2.value;

var drawImageCounter = 0;
var gridLoadCounter = 0;
var ringsLoadCounter = 0;
var frontierLoadCounter = 0;
var eclipseLoadCounter = 0;

//Save and export the new image in png format
var saveButton = document.getElementById('save-image-button');

saveButton.addEventListener('click', () => {
    saveImage();
});


var keyPixelArray = [];

//add gui
var obj = {
    backgroundColor: "#fff9eb",
    noiseColor: "#0011FF",
    edgeColor: "#000000",
    edgeSensitivity: 70,
    maxSmear: 30,
    randomDots: 50,
    noiseOpacity: 30,
    power: 35,
    angle: 0,
};

var gui = new dat.gui.GUI( { autoPlace: false } );
gui.close();
var guiOpenToggle = false;

obj['importImage'] = function () {
imageInput.click();
};
gui.add(obj, 'importImage').name("Import Image");

gui.addColor(obj, "backgroundColor").name("Background Color").onFinishChange(drawPixels);
gui.addColor(obj, "noiseColor").name("Noise Color").onFinishChange(drawPixels);
gui.addColor(obj, "edgeColor").name("Edge Color").onFinishChange(drawPixels);
gui.add(obj, "edgeSensitivity").min(1).max(100).step(1).name('Edge Sensitivity').onFinishChange(analyseImage);
gui.add(obj, "maxSmear").min(1).max(100).step(1).name('Smear Width').onFinishChange(drawPixels);
gui.add(obj, "randomDots").min(1).max(100).step(1).name('# Random Dots').onFinishChange(drawPixels);
gui.add(obj, "noiseOpacity").min(1).max(100).step(1).name('Dot Opacity').onFinishChange(drawPixels);
gui.add(obj, "power").min(1).max(100).step(1).name('Cluster Power').onFinishChange(drawPixels);
gui.add(obj, "angle").min(0).max(360).step(1).name('Angle').onFinishChange(drawPixels);

obj['refreshCanvas'] = function () {
refresh();
};
gui.add(obj, 'refreshCanvas').name("Refresh Canvas (r)");

obj['saveImage'] = function () {
saveImage();
};
gui.add(obj, 'saveImage').name("Image Export (i)");

obj['saveVideo'] = function () {
toggleVideoRecord();
};
gui.add(obj, 'saveVideo').name("Start/Stop Video Export (v)");

customContainer = document.getElementById( 'gui' );
customContainer.appendChild(gui.domElement);

// Add event listeners to the input boxes
imageInput.addEventListener('change', readSourceImage);

visualizationChoiceMenu.addEventListener('change',refresh);
redInput.addEventListener('change', refresh);
greenInput.addEventListener('change', refresh);
blueInput.addEventListener('change', refresh);
alphaInput.addEventListener('change', refresh);
smearWidthInput.addEventListener('change', refresh);
chosenPixelInput.addEventListener('change', refresh);
noiseProbabilityInput.addEventListener('change', refresh);
noiseColorRangeInput.addEventListener('change', refresh);
dotSizeFactorInput.addEventListener('change', refresh);

paletteChoiceInput.addEventListener('change', changePalette);
dualColorPicker1.addEventListener('change', refresh);
dualColorPicker2.addEventListener('change', refresh);
lightnessLevelInput.addEventListener('change', refresh);
saturationLevelInput.addEventListener('change', refresh);

//main method
getUserInputs();
initColorPickers();

// Grab new user inputs from control menu
function getUserInputs() {

    visualizationChoice = String(visualizationChoiceMenu.value);

    redShift = parseInt(redInput.value);
    greenShift = parseInt(greenInput.value);
    blueShift = parseInt(blueInput.value);
    alphaShift = parseFloat(alphaInput.value);

    smearWidth = Math.min(100,Math.max(0,Number(smearWidthInput.value)));
    chosenPixel = Math.min(100,Math.max(0,Number(chosenPixelInput.value)));
    noiseProbability = Math.min(100,Math.max(0,Number(noiseProbabilityInput.value)));
    noiseColorRange = Math.min(100,Math.max(0,Number(noiseColorRangeInput.value)));
    dotSizeFactor = Math.min(100,Math.max(0,Number(dotSizeFactorInput.value)));

    rgbColorRange = noiseColorRange/100 * 255;

    dualColor1 = dualColorPicker1.value;
    dualColor2 = dualColorPicker2.value;

    lightnessLevel = Math.min(100,Math.max(0,Number(lightnessLevelInput.value)));
    saturationLevel = Math.min(100,Math.max(0,Number(saturationLevelInput.value)));

    //set background color
    if(visualizationChoice == previousVisualizationChoice){
        backgroundColor = backgroundColorInput.value;
    } else if(visualizationChoice == "eclipse"){
        backgroundColorInput.value = "#000000";
        backgroundColor = "#000000";
    } else {
        backgroundColorInput.value = "#FFF9EB";
        backgroundColor = "#FFF9EB";
    }

    toggleInputMenu();
}

function toggleInputMenu(){

    var numColumns = 12;

    //columns: Style, RGBA shift, Smear, Sensitivity, Color Range, Max Dot Size, Palette, Color pickers, Background, dual color picker
    //Value of 1 if the columnn should be shown for that style, 0 if hidden
    var menuControlFlags = [
        {menuOptions: [1,0,0,0,1,1,0,0,0,0,0,0], name: "pointillist"},
        {menuOptions: [1,0,0,1,0,0,0,0,0,0,0,0], name: "sketch"},
        {menuOptions: [1,0,0,1,0,0,0,0,0,0,0,0], name: "roller"},
        {menuOptions: [1,0,0,1,0,0,1,1,0,0,0,0], name: "palletize"},
        {menuOptions: [1,0,0,1,0,0,0,0,0,0,0,0], name: "pixel"},
        {menuOptions: [1,0,0,1,0,0,0,0,1,0,0,0], name: "clippings"},
        {menuOptions: [1,0,0,1,0,0,0,0,0,0,0,0], name: "grid"},
        {menuOptions: [1,0,0,1,0,0,1,1,0,0,0,0], name: "mondrian"},
        {menuOptions: [1,0,0,1,0,1,0,0,1,0,0,0], name: "rings"},
        {menuOptions: [1,0,0,1,0,0,0,0,1,0,0,0], name: "gumball"},
        {menuOptions: [1,0,0,1,0,0,0,0,0,0,0,0], name: "noisySort"},
        {menuOptions: [1,0,0,1,0,0,0,0,0,0,0,0], name: "void"},
        {menuOptions: [1,0,0,1,0,0,0,0,1,0,0,0], name: "braille"},
        {menuOptions: [1,0,0,1,0,0,1,1,0,0,0,0], name: "dust"},
        {menuOptions: [1,0,0,1,0,0,0,0,0,1,0,0], name: "outlines"},
        {menuOptions: [1,0,0,1,0,0,0,0,1,0,0,0], name: "frontier"},
        {menuOptions: [1,0,0,1,0,0,0,0,1,0,0,0], name: "eclipse"},
        {menuOptions: [1,0,0,0,0,0,0,0,1,0,1,1], name: "satLight"},
        {menuOptions: [1,0,0,1,0,0,0,0,1,1,0,0], name: "edgy"},
        {menuOptions: [1,0,0,1,0,0,0,0,0,0,0,0], name: "shadow"},
    ];

    var styleIndex = menuControlFlags.findIndex(obj => obj.name == visualizationChoice);

    for(var idx=0; idx<numColumns; idx++){
        var className = ".inputCol"+(idx+1);
        var elements = document.querySelectorAll(className);
        elements.forEach(element => {
            if(menuControlFlags[styleIndex].menuOptions[idx] == 1){
                element.classList.remove('hidden');
            } else {
                element.classList.add('hidden');
            }
        });
    }
    
}

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

        refresh();

    };
  };
  reader.readAsDataURL(file);

  isImageLoaded = true;

}

function refresh(){

    console.log("refresh");

    getUserInputs();
    setTimeout(analyseImage,5);

}

function analyseImage(){

    //remove any existing new images
    while (newImageContainer.firstChild) {
        newImageContainer.removeChild(newImageContainer.firstChild);
    }

    lightDataArray = [];
    smoothedLightDataArray = [];
    keyPixelArray = [];

    if(visualizationChoice == "edgy"){
        console.log("running edgy visual");

        var lightDataArray = [];

        //generate data array for all pixel lightness values
        for(var y=0; y < actualHeight; y++ ){

            lightDataArray[y] = [];

            for(var x=0; x < actualWidth; x++ ){

                var actualPixel = (y * actualWidth + x) * 4;
                var actualRed = pixels[actualPixel];
                var actualGreen = pixels[actualPixel + 1];
                var actualBlue = pixels[actualPixel + 2];
                //var actualLightness = rgbToLightness(actualRed, actualGreen, actualBlue);
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

        var threshold = 0.165 - (obj.edgeSensitivity/100 * 0.15);

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
        drawPixels();
    }
}

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

    var xSlope;
    var ySlope;

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

        for(var j=0; j<obj.randomDots; j++){
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

    previousVisualizationChoice = visualizationChoice;

}

//Helper Functions

function angleToSlope(angle) {
    const radians = angle * Math.PI / 180;
    const slope = Math.tan(radians);
    return { x: 1, y: slope };
}

function angleToSlopeXY(angle) {
    const slope = angleToSlope(angle);
    return { x: slope.x, y: slope.y };
}

//shortcut key presses
document.addEventListener('keydown', function(event) {
    if (event.key === 'r') {
        refresh();

    } else if (event.key === 's') {
        saveImage();
    } else if (event.key === 'e') {
        saveBothImages();
    }
});

function saveImage(){
    const image = newImageContainer.querySelector('img');
    const imageUrl = image.src;
    const link = document.createElement('a');
    const date = new Date();
    const filename = `image_${date.toLocaleDateString()}_${date.toLocaleTimeString()}.png`;
    
    // Create a blob from the image
    fetch(imageUrl)
        .then(response => response.blob())
        .then(blob => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();
        });

}

function saveBothImages(){

    // Get the two images
    const originalImage = imageContainer.querySelector('img');
    const newImage = newImageContainer.querySelector('img');

    // Create a canvas element
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    // Set the canvas dimensions to match the combined width of the two images
    canvas.width = actualWidth*2;
    canvas.height = actualHeight;
    console.log("Save both images -- canvas width / height: "+canvas.width+", "+canvas.height);

    // Draw the original image on the left side of the canvas
    ctx.drawImage(originalImage, 0, 0, actualWidth, actualHeight);

    // Draw the new image on the right side of the canvas
    ctx.drawImage(newImage, actualWidth, 0, actualWidth, actualHeight);

    // Use the canvas.toDataURL() method to generate a data URL for the combined image
    const combinedImageURL = canvas.toDataURL();

    const link = document.createElement('a');
    const date = new Date();
    const filename = `image_${date.toLocaleDateString()}_${date.toLocaleTimeString()}.png`;
    
    // Create a blob from the image
    fetch(combinedImageURL)
        .then(response => response.blob())
        .then(blob => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();
        });

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

//returns random number between 0-1 based on normal distribution
function randomBM() {
    let u = 0, v = 0;
    while(u === 0) u = Math.random(); //Converting [0,1) to (0,1)
    while(v === 0) v = Math.random();
    let num = Math.sqrt( -2.0 * Math.log( u ) ) * Math.cos( 2.0 * Math.PI * v );
    num = num / 10.0 + 0.5; // Translate to 0 -> 1
    if (num > 1 || num < 0) return randn_bm() // resample between 0 and 1
    return num
}

function extractRGB(rgbString) {
    const rgbRegex = /rgb\((\d+),\s*(\d+),\s*(\d+)\)/;
    const match = rgbString.match(rgbRegex);
    if (match) {
        return {
        r: parseInt(match[1]),
        g: parseInt(match[2]),
        b: parseInt(match[3]),
        };
    } else {
        return null;
    }
}

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

function hexToRgb(hex) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return { r, g, b };
}



function initColorPickers(){

    colorPicker.addEventListener('change', (e) => {
        updateColorPickers();
    });

    colorPicker2.addEventListener('change', (e) => {
        updateColorPickers();
    });

    colorPicker3.addEventListener('change', (e) => {
        updateColorPickers();
    });

    colorPicker4.addEventListener('change', (e) => {
        updateColorPickers();
    });

    colorPicker5.addEventListener('change', (e) => {
        updateColorPickers();
    });

    colorPicker6.addEventListener('change', (e) => {
        updateColorPickers();
    });

    backgroundColorInput.addEventListener('change', (e) => {
        refresh();
    });    
}

function changePalette(){

    paletteChoice = paletteChoiceInput.value;
    
    for (let idx = 0; idx < palettePresets.length; idx++){
        if (palettePresets[idx].name == paletteChoice){
            chosenPalette = palettePresets[idx].palette;
            break;
        }
    }

    for (let idx = 0; idx < pickers.length; idx++){
        pickers[idx].value = chosenPalette[idx];
    }
    
    updateColorPickers();    
}

function updateColorPickers(){

    for (let idx = 0; idx < pickers.length; idx++){
        var currentColor = pickers[idx].value;
        chosenPalette[idx] = currentColor;
        var currentColorRGB = hexToRgb(currentColor);
        chosenPaletteRGBValues[idx] = [currentColorRGB.r, currentColorRGB.g, currentColorRGB.b];
    }

    //Modify and save changes to custom palette
    var customIndex = palettePresets.findIndex(obj => obj.name === "custom");
    console.log("Palette choice: "+paletteChoice);
    if(paletteChoice == "custom"){
        palettePresets[customIndex].palette = chosenPalette;
    }

    refresh();
}