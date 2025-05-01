import { useEffect } from "react";

const AudioPlayer = ({ text, play, onEnd }) => {
  useEffect(() => {
    // Safari兼容：提前加载语音
    window.speechSynthesis.getVoices();
  }, []);

  useEffect(() => {
    if (play && text) {
      const synth = window.speechSynthesis;
      synth.cancel(); // 防止叠音

      const utter = new window.SpeechSynthesisUtterance(text);
      utter.lang = /[\u4e00-\u9fa5]/.test(text) ? "zh-CN" : "en-US";
      utter.rate = 1;
      utter.pitch = 1.1;
      utter.volume = 1;

      if (onEnd) {
        utter.onend = onEnd;
      }

      synth.speak(utter);
    }
    // eslint-disable-next-line
  }, [play, text]);

  return null;
};

export default AudioPlayer;
