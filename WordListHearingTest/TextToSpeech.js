var g_selectedVoice = 0;
var g_selectedPitch = 1;
var g_selectedRate = 1;

function populateVoices(id) {
  voicesElement = document.getElementById(id);

  if (voicesElement.options.length == 0) {
    var allVoices = speechSynthesis.getVoices();

    var englishVoices = allVoices.filter(function(value, index, arr){ return value.name.includes("English"); });

    for (var i = 0; i < englishVoices.length; i++) {
      var option = document.createElement("option");
      option.text = englishVoices[i].name;
      voicesElement.add(option);
    }
  }
}

function onVoiceSelected(name) {
  var voices = speechSynthesis.getVoices();

  for (var i = 0; i < voices.length; i++) {
    if (voices[i].name === name) {
      g_selectedVoice = i;
      break;
    }
  }
}

function onPitchSelected(value) {
  g_selectedPitch = parseFloat(value);
}

function onRateSelected(value) {
  g_selectedRate = parseFloat(value);
}

function readText(text) {
  var utterance = new SpeechSynthesisUtterance();
  utterance.text = text;

  // Configure the speech characteristics.
  utterance.pitch = g_selectedPitch;
  utterance.rate = g_selectedRate;
  utterance.volume = 1;
  utterance.voice = speechSynthesis.getVoices()[g_selectedVoice];

  speechSynthesis.speak(utterance);
}
