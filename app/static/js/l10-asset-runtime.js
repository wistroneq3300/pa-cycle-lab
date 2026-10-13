/* GLB GPU adapter for the opt-in, single-board asset prototype.
 * Animation stays in PACoreScene; this adapter owns only buffers/material maps.
 */
(()=>{
 'use strict';
 const uniformNames=['uAsset','uAssetNormalScale','uAssetRoughness','uAssetAO','uAssetAlphaCutoff','uAssetAlphaMask','uAssetBase','uAssetMR','uAssetNormal','uAssetOcclusion'];
 function upload(gl,asset,attributes,uniforms){
  const buffers=[],textures=[],images=new Map();let textureBytes=0;
  function texture(image,sampler,fallback){
   const key=image||fallback.join(',');let variants=images.get(key);if(!variants){variants=new Map();images.set(key,variants);}
   const s=sampler||{magFilter:9729,minFilter:9729,wrapS:10497,wrapT:10497},signature=JSON.stringify(s);
   if(variants.has(signature))return variants.get(signature);
   const t=gl.createTexture();textures.push(t);gl.activeTexture(gl.TEXTURE2);gl.bindTexture(gl.TEXTURE_2D,t);
   gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL,gl.NONE);
   let w=1,h=1;
   if(image){w=image.width;h=image.height;gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,image);}
   else gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array(fallback));
   const pot=(w&(w-1))===0&&(h&(h-1))===0,mipmap=pot&&[9984,9985,9986,9987].includes(s.minFilter);
   gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,s.magFilter);
   gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,!pot&&s.minFilter!==9728?gl.LINEAR:s.minFilter);
   gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,pot?s.wrapS:gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,pot?s.wrapT:gl.CLAMP_TO_EDGE);
   if(mipmap)gl.generateMipmap(gl.TEXTURE_2D);textureBytes+=Math.ceil(w*h*4*(mipmap?4/3:1));variants.set(signature,t);return t;
  }
  let primitives;
  try{primitives=asset.primitives.map(p=>{
   if(p.material.alphaMode!=='OPAQUE')throw new Error('L10 prototype renderer requires opaque glTF materials; cinematic ghosting is controlled by its semantic layer');
   const buffer=gl.createBuffer();buffers.push(buffer);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,p.data,gl.STATIC_DRAW);
   const m=p.material;
   return {...p,buffer,count:p.data.length/12,maps:[
    texture(m.baseColorTexture,m.baseColorSampler,[255,255,255,255]),
    texture(m.metallicRoughnessTexture,m.metallicRoughnessSampler,[255,255,255,255]),
    texture(m.normalTexture,m.normalSampler,[128,128,255,255]),
    texture(m.occlusionTexture,m.occlusionSampler,[255,255,255,255])
   ]};
  });
  if(gl.getError()!==gl.NO_ERROR)throw new Error('L10 prototype GPU upload failed');
  }catch(error){buffers.forEach(b=>gl.deleteBuffer(b));textures.forEach(t=>gl.deleteTexture(t));asset.disposeImages();gl.activeTexture(gl.TEXTURE0);throw error;}
  gl.activeTexture(gl.TEXTURE0);
  function draw(layer,matrix,opacity,writeDepth,shadowPass){
   if(opacity<=.003||shadowPass&&(opacity<.96||!writeDepth))return 0;
   let calls=0;
   for(const p of primitives){if(p.layer!==layer)continue;const m=p.material;
    gl.bindBuffer(gl.ARRAY_BUFFER,p.buffer);
    for(const [name,size,offset]of [['aPosition',3,0],['aNormal',3,12],['aUV',2,24],['aTangent',4,32]]){gl.enableVertexAttribArray(attributes[name]);gl.vertexAttribPointer(attributes[name],size,gl.FLOAT,false,48,offset);}
    gl.disableVertexAttribArray(attributes.aColor);gl.vertexAttrib4fv(attributes.aColor,[...m.baseColorFactor.slice(0,3),1]);
    gl.disableVertexAttribArray(attributes.aMaterial);gl.vertexAttrib2f(attributes.aMaterial,m.metallicFactor,0);
    gl.uniform1f(uniforms.uAsset,1);gl.uniform1f(uniforms.uAssetRoughness,m.roughnessFactor);gl.uniform1f(uniforms.uAssetNormalScale,m.normalTexture?m.normalScale:0);
    gl.uniform1f(uniforms.uAssetAO,m.occlusionTexture?m.occlusionStrength:0);gl.uniform1f(uniforms.uAssetAlphaMask,m.alphaMode==='MASK'?1:0);gl.uniform1f(uniforms.uAssetAlphaCutoff,m.alphaCutoff);
    ['uAssetBase','uAssetMR','uAssetNormal','uAssetOcclusion'].forEach((name,i)=>{gl.activeTexture(gl.TEXTURE2+i);gl.bindTexture(gl.TEXTURE_2D,p.maps[i]);gl.uniform1i(uniforms[name],i+2);});
    gl.uniformMatrix4fv(uniforms.uPart,false,matrix);gl.uniform1f(uniforms.uOpacity,opacity);gl.depthMask(writeDepth);
    if(m.doubleSided)gl.disable(gl.CULL_FACE);else{gl.enable(gl.CULL_FACE);gl.cullFace(gl.BACK);}
    gl.drawArrays(gl.TRIANGLES,0,p.count);calls++;
   }
   gl.disable(gl.CULL_FACE);gl.activeTexture(gl.TEXTURE0);gl.uniform1f(uniforms.uAsset,0);return calls;
  }
  return {draw,metadata:{...asset.metadata,primitives:primitives.length,vertices:primitives.reduce((n,p)=>n+p.count,0),bufferBytes:primitives.reduce((n,p)=>n+p.data.byteLength,0),textureBytes,textureObjects:textures.length,layers:[...new Set(primitives.map(p=>p.layer))]},destroy(lost=false){if(!lost){buffers.forEach(b=>gl.deleteBuffer(b));textures.forEach(t=>gl.deleteTexture(t));}asset.disposeImages();}};
 }
 window.PAL10AssetRuntime=Object.freeze({upload,uniformNames});
})();
