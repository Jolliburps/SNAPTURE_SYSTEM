"""Conservative sheet-boundary refinement; no arbitrary bounding-box padding."""
def refine_sheet(image,row):
    if row.get('material') not in {'paper','cardboard'} or row.get('detection_status')!='accepted': return row
    import cv2
    import numpy as np
    rgb=np.array(image.convert('RGB'))
    scale=min(1.,800/max(image.size))
    rgb=cv2.resize(rgb,None,fx=scale,fy=scale)
    h,w=rgb.shape[:2]
    edges=cv2.Canny(cv2.GaussianBlur(cv2.cvtColor(rgb,cv2.COLOR_RGB2GRAY),(5,5),0),40,120)
    edges=cv2.morphologyEx(edges,cv2.MORPH_CLOSE,np.ones((3,3),np.uint8))
    contours,_=cv2.findContours(edges,cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_SIMPLE)
    a,b,c,d=row['box'];old=(c-a)*(d-b)
    candidates=[]
    for contour in contours:
        polygon=cv2.approxPolyDP(contour,.025*cv2.arcLength(contour,True),True)
        if len(polygon)!=4 or not cv2.isContourConvex(polygon): continue
        x,y,cw,ch=cv2.boundingRect(polygon)
        box=[x/w,y/h,min(1.,(x+cw)/w),min(1.,(y+ch)/h)]
        area=(box[2]-box[0])*(box[3]-box[1])
        overlap=max(0,min(c,box[2])-max(a,box[0]))*max(0,min(d,box[3])-max(b,box[1]))
        # Require a substantial sheet enclosing nearly all of the proposal,
        # modest expansion, and strong contour fill. Do not absorb a background frame.
        if old<=0 or not (1.08*old<=area<=1.8*old) or area>.9 or overlap/old<.90: continue
        if cv2.contourArea(contour)/(cw*ch)<.72: continue
        candidates.append((area,box))
    if not candidates:return row
    _,box=min(candidates)
    return {**row,'box':box,'extent_refinement':{'method':'sheet_edges_v1','original_box':row['box']}}
