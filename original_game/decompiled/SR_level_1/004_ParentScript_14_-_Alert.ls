on alertHook me, err, msg
  the debugPlaybackEnabled = 1
  put "ERROR: " & err & ", " & msg
  return 1
end
