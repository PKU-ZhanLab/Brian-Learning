# S4 actual CUA acceptance

2026-10-29, root used fixed build preview4192 (noHMR). A/B aal3-registered, actualThal_Re_R label134.
- 2mm: reportsource7voxels/7mm3,target0/0forboth; explicitwarning+confirmation required. Cancel clearsreportandreenablescompute. Recompute+confirm producesemptytargetwithDice/Jaccard dash, not disjointnonemptywording.
- Change1mm invalidatesoldmetrics; compute reports7/7sourceandtarget forboth, Dice/Jaccard1.0000, intersection7.
- Actual UI ExportROI A NIfTIdownload returned C:/Users/win/Downloads/ROI-A.nii; Node parser verifiedshape181x217x181, affine1mmRASorigin[-90,-126,-72], positivevoxels7, bytecount7109489, SHA2564eb83fa5c7a8ec17104fe9517c1919295650de5dcffe15bd8d3599f9d9981e1f. Copy+receipt output/s4-cua/.
- Changeback2mm clearsmetricsandsamplingreport.
Screenshots output/s4-2mm-sampling-loss.png and output/s4-1mm-label134.png. ActualautomatedbrowserCI/delayedrace suite stillnotrun; workerNodecoversrequests/cancel. Noanatomicalaccuracy/humanreviewclaim. W6mustpreserveresolutionMmandresultsprovenance.
