global myNetID, myBytesLoaded, myBytesTotal, myNetURL

on exitFrame me
  put getStreamStatus(myNetURL)
  dirBytesLoaded = max(0, myBytesLoaded)
  dirBytesTotal = max(0.001, myBytesTotal)
  dirBytesPercent = float(dirBytesLoaded) / float(dirBytesTotal) * 100
  sprite(2).setVariable("progressTxt", string("loading... " & min(100, integer(dirBytesPercent)) & "%"))
  sprite(2).setFlashProperty("progBar", #scaleX, min(100, integer(dirBytesPercent)))
  go(the frame)
end
