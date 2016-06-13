window.PhaserHelper = {
  getCollisionIndexes: function(phaser, tilemap_cache_name, collision_key) {
    if(collision_key === undefined) collision_key = "slope"
    var map_tileproperties = phaser.cache.getTilemapData(tilemap_cache_name).data.tilesets[0].tileproperties;
    return _.reduce(map_tileproperties, function(memo, v, k){
      if(v[collision_key] === undefined) return memo;
      else return memo.concat(parseInt(k) + 1);
    },[]);
  },

  fixTilesetPropertiesIndex: function(phaser, tilemap_cache_name) {
    var map_tileproperties = phaser.cache.getTilemapData(tilemap_cache_name).data.tilesets[0].tileproperties;
    return _.reduce(map_tileproperties, function(memo, v, k){
      if(v[collision_key] === undefined) return memo;
      else return memo.concat(parseInt(k) + 1);
    },[]);
  }
}
