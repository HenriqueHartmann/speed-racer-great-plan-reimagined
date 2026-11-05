global gGameMODE, gLevel, gPosition, isUnlocked, hasReported, myNetID, myStreamState, myStreamError, myBytesLoaded, myBytesTotal, myNetURL, gSCRIPTS, isProjector, windowRect, windowMODE

on prepareMovie me
  _player.cursor(-1)
  the romanLingo = 1
end

on startMovie
  _movie.exitLock = 0
  if (the environment).runMode = "Author" then
    return 
  end if
  if gSCRIPTS.ilk = #script then
    if gSCRIPTS.doCheck() <> 1 then
      go("ERROR")
      abort()
      gotoNetPage("http://www.shockwave.com")
    end if
  else
    go("ERROR")
    abort()
    gotoNetPage("http://www.shockwave.com")
  end if
end

on closeWindow me
  window("MINIGAME").forget()
end
