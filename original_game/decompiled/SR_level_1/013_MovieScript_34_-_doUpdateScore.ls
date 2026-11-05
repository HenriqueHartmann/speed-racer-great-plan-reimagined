global mCamera, ovScore_6, ovScore_5, ovScore_4, ovScore_3, ovScore_2, ovScore_1, ovScoreList, gScore, gTextures

on doUpdateScore me
  tScore = gScore
  t6 = tScore / 100000
  tScore = tScore - (t6 * 100000)
  t5 = tScore / 10000
  tScore = tScore - (t5 * 10000)
  t4 = tScore / 1000
  tScore = tScore - (t4 * 1000)
  t3 = tScore / 100
  tScore = tScore - (t3 * 100)
  t2 = tScore / 10
  tScore = tScore - (t2 * 10)
  t1 = tScore / 1
  tScore = tScore - (t1 * 1)
  mCamera.overlay[ovScore_1].source = gTextures.getProp("Digit_" & t1)
  mCamera.overlay[ovScore_2].source = gTextures.getProp("Digit_" & t2)
  mCamera.overlay[ovScore_3].source = gTextures.getProp("Digit_" & t3)
  mCamera.overlay[ovScore_4].source = gTextures.getProp("Digit_" & t4)
  mCamera.overlay[ovScore_5].source = gTextures.getProp("Digit_" & t5)
  mCamera.overlay[ovScore_6].source = gTextures.getProp("Digit_" & t6)
end
