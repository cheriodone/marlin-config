function _add(tmpl){
    tmpl.parent().append(tmpl.prop('content').cloneNode(true))
    return tmpl.parent().children().last()
}
function loadHint(name){
  $.ajax('/hint/'+name).then(function(data){
    $('.mct-hint').html(data);
  })
}
function saveProp(cmd){
var state=$('.mct-header .mct-status')
  state.text('saving...').fadeIn().css({color:'black'});
  return $.post(cmd)
  .then(function(a){ state.text('saved').fadeOut(1000); return a})
  .fail(function(a){ state.text(''+a.responseJSON.code).css({color:'red'})})
}
function applyProp(def,row,prop,val){
  def.changed=def.changed||{}
  def.changed[prop]=val
  var ch=['disabled','value'].filter(function(i){ return i in def.changed &&def.changed[i]!=def[i]})
  row.toggleClass('bg-info',!!ch.length)
}
function updateChanged(sec){
  var cnt=sec.find('.form-group.bg-info').length;
  sec.find('.card-header span.badge:eq(1)').text(cnt);
}
function getVal(ob,name){
  if( ob.changed != undefined)
//    if( 'changed' in ob)
    return ob.changed[name]
  return ob[name]
}
function cmdReload(cmd,modal){
    cmd
    .then(function(data){
      $(window).unbind('beforeunload');
      window.location.reload();
    })
    .fail(function(a){
      modal&&modal.modal('hide')
      _add($('template._alert'))
      .find('p').text(a.responseText)
    })
}
function progress(val){
    var dom = $('.mct-progress');
    val===true&&dom.toggle(val);
    val===false&&dom.fadeOut(5000);
    if (typeof val =='string'){
      dom.find('span').text(val)
      $('.mct-progress .progress-bar').width(val);
    }
    typeof val =='number'&& dom.find('.progress-bar').toggleClass('progress-bar-danger',!!val);
    return progress;
}
// The plugin code https://gist.github.com/meleyal/3794126
$.fn.draghover = function(options) {
  return this.each(function() {
    var collection = $(),
        self = $(this);
    self.on('dragenter', function(e) {
      if (collection.length === 0) {
        self.trigger('draghoverstart');
      }
      collection = collection.add(e.target);
    });
    self.on('dragleave drop', function(e) {
      collection = collection.not(e.target);
      if (collection.length === 0) {
        self.trigger('draghoverend');
      }
    });
  });
};
function upload_files(files){
//  return new Promise((done,fail)=>{
    if ( !files.length )
      return fail('no files')
    var formData = new FormData();
    for (var i = 0; i < files.length; i++) {
      var file = files[i];
      formData.append('uploads[]', file, file.name);
    }
    progress(0)(true);
    return $.ajax({
      url: '/upload',
      type: 'POST',
      data: formData,
      processData: false,
      contentType: false,
      success: function(data){
          console.log('upload successful!\n' + data);
      },
      xhr: function() {
        var xhr = new XMLHttpRequest();
        xhr.upload.addEventListener('progress', function(evt) {
          if (evt.lengthComputable) {
            // calculate the percentage of upload completed
            var percentComplete = evt.loaded / evt.total;
            percentComplete = parseInt(percentComplete * 100);
            progress(percentComplete + '%');
            // update the Bootstrap progress bar with the new percentage
            // once the upload reaches 100%, set the progress bar text to done
            if (percentComplete === 100){
              progress(false);
//              done();
            }
          }
        }, false);
        return xhr;
      }
    }).fail(function(e){
      progress(1)('ERROR '+e.responseText);
//      fail(e.responseText)
    });
//  })
}
function stream_cmd(command,proc){
    return function(){
      if (!config.pio) return proc.info();
      proc.init();
      function log_message(text){
        proc.log(text);
      }
      try{
        var xhr = new XMLHttpRequest();
        xhr.previous_text = '';
        xhr.onload = function() { log_message("<br>Done."); };
        xhr.onerror = function() { log_message("<br>[XHR] Fatal Error."); };
        xhr.onreadystatechange = function(){
          try{
            if (xhr.readyState > 2){
              var new_response = xhr.responseText.substring(xhr.previous_text.length);
              log_message(new_response.replace(/\n/g,'<br>'));
              xhr.previous_text = xhr.responseText;
            }
          }catch (e){
            log_message("<br><b>[XHR] Exception: " + e + "</b>");
          }
        }
        xhr.open("GET", command, true);
        xhr.send("let's go");
      }catch (e){
        log_message("<br><b>[XHR] Exception: " + e + "</b>");
      }
    }
}
$(function(){
    //uploader decoration
    var dropZone=$('#mct-dragzone')
    $(window)
    //properly check enter & leave window
    .draghover().on('draghoverstart draghoverend', function(ev) {
      dropZone.toggle(ev.type=='draghoverstart');
    });
    $(window)
    //.on('beforeunload',function(){ return "Do You want leave page?"})
    //prevent drop on window
    .on('drop',function(ev) {
      ev.preventDefault();
    })
    .on('dragover', function(ev) {
      ev.preventDefault();
    })
    dropZone.on('dragover dragleave', function(ev) {
        dropZone.toggleClass('drop',ev.type=='dragover');
        if (ev.type=='dragover')
            ev.preventDefault();
    })
    dropZone.on('drop',function(ev) {
        ev.preventDefault();
        cmdReload(upload_files(ev.originalEvent.dataTransfer.files))
    })
    $('button.mct-upload').on('click', function(){
      $('input.mct-upload').trigger('click')
    });
    $('input.mct-upload').on('change',function(){
      var files = $(this).get(0).files;
      cmdReload(upload_files(files));
    });
    //end uploader decoration

    var defs=$.get('/json');
    defs.then(function(data){
      data.forEach(function(file){
        if (file.type=='info'){
          $('.mct-version').attr('href',file.pkg.homepage).text(file.pkg.name+' v'+file.pkg.version)
          return;
        }
        $('.mct-tags').eq(0).text(file.tag)
        var href='card-'+file.file.name;
        _add($('template._file_tab'))
        .find('a').text(file.file.name)
        .attr('href','#'+href)
        var tab=_add($('template._file_content'))
        tab.attr('id',href)
        $.each(file.sections,function(n,section){
          var sec=_add(tab.find('template._section'));
          sec.find('.card-header span:eq(0)').text(section);
          var cnt=0;
          $.each(file.list[section],function(n,define){
            cnt++;
            var d=_add(sec.find('template.define'))
            var def=file.defs[define]
            if (def.changed)
              d.addClass('bg-info')
            d.find('label').eq(0).text(define).attr('title',def.line).tooltip();
            var dis=d.find('.onoffswitch')
            var dv=(def.changed&&def.changed.value||def.value);
            if (def.type=='string')
              dv=dv.slice(1,-1)
            var val=d.find('input[type=text]').val(dv);
            function processProp(name,val){
              saveProp('/set/'+file.file.name+'/'+define+'/'+name+'/'+val)
              .then(function(){ applyProp(def,d,name,val)})
              .then(function(){ updateChanged(d.parents('.card'))})
            }
            dis.find('input')
            .attr('checked',!getVal(def,'disabled'))
            .on('change',function(){
              processProp('disabled',!$(this).prop('checked'));
            })
            val.on('change',function(){
              var dv=$(this).val();
              if (def.type=='string')
                dv='"'+dv+'"';
              processProp('value',dv);
            })
            var p=d.find('.col-sm-6 p');
            var b=d.find('button');
            if (/_adv$/.test(file.file.name))
              b.remove();
            else
              b.on('click',function(){loadHint(define)})
            if (def.value == undefined)
              val.remove(),p.remove();
            if (! def.disabled && def.value != undefined)
              dis.remove(),p.remove();
            if (def.hint == undefined)
              d.find('button').remove();
          })
          sec.find('.card-header span.badge:eq(0)').text(cnt);
          updateChanged(sec);
//          sec.find('[type=checkbox]').bootstrapToggle()
          with(sec.find('.card-header button')){
            eq(1).on('click',function(){sec.find('.form-group').not('.bg-info').hide()})
            eq(0).on('click',function(){sec.find('.form-group').show()})
          }
        })
      })
      $('.config-files li:eq(0) a').eq(0).trigger('click');
    });
  (function(){
    var m=$('#mct-tags-modal');
    var a=$('#mct-alert');
    var t=m.find('table tbody');
    m.find('button.btn-primary').on('click',function(ev){
      var row = t.find('.table-success');
      if(row.length){
        var tag=row.find('td').eq(1).text().split(',');
        cmdReload($.ajax('/checkout/'+tag[0]),m);
      }
    });
    m.find('table tbody').on('click',function(ev){
      $(this).find('tr').removeClass('table-success');
      $(ev.target).parents('tr').addClass('table-success')
    });
    $('.mct-tags').on('click',function(){
      $.ajax('/tags').then(function(data){
        data=data.sort(function(a,b){ return a.date<b.date?1:a.date>b.date?-1:0;})
        t.empty();
        data.map(function(row){
          t.append($('<tr>').append($('<td>').text(row.date)).append($('<td>').text(row.tag)))
        })
        m.modal();
      })
    })
  })();
  (function(){
    var r=$('#mct-reset-modal');
    var p=r.find('p');
    $('.mct-reset').on('click',function(){
      $.ajax('/status').then(function(data){
        p.empty();
        data.files.map(function(file){
          p.append(file.path+'<br>')
        })
        r.modal();
      })
    })
    r.find('button.btn-primary').on('click',function(ev){
        cmdReload($.ajax('/checkout-force'),r);
    })
  })();
  (function(){
    var r=$('#mct-pio-modal');
    var p=r.find('p');
    var proc={}
    proc.init=function(){ p.empty(); r.modal();}
    proc.info=function(){
      _add($('template._alert'))
      .find('p').html('to install PlatformIO use guide from <strong><a target="_blank" href="http://docs.platformio.org/en/latest/installation.html">Official site</a></strong>')
    }
    proc.log=function(text){ p.append(text); }
    $('.mct-pio-compile, .mct-pio-flash, .mct-port')
    .toggleClass('disabled',!config.pio)
    .attr(config.pio?'title':'null','')
    .eq(0).on('click',stream_cmd('/pio',proc)).end()
    .eq(1).on('click',stream_cmd('/pio-flash',proc)).end()
    var m=$('.mct-port .dropdown-menu');
  //  m.empty();
    config.pio&&
    config.pio.map(function(i){
      m.append($('<a class="dropdown-item" href="#"></a>').text(i.port))
    });
  })();
    $('.mct-issue').on('click',function(){
      defs.then(function(data){
        var text='';
        data.forEach(function(file){
          var f='';
          $.each(file.sections,function(n,section){
            var lines='';
            $.each(file.list[section],function(n,define){
              var def=file.defs[define]
              if (def.changed){
                var ch=['disabled','value'].filter(function(i){ return i in def.changed &&def.changed[i]!=def[i]})
                if (ch.length)
                  lines+=(( ch.indexOf('disabled')>=0 ? def.changed.disabled : def.disabled)?'//':'')
                    +'#define '+define+' '
                    +(( ch.indexOf('value')>=0 ? def.changed.value : def.value)||'')
                    +'\n';
              }
            })
            if (lines)
              f+='//section '+section+'\n'+lines
          })
          if (f)
            text+='\n//file '+file.file.base+' Release:'+file.tag+'\n'+f;
        })
        window.open(encodeURI('https://github.com/MarlinFirmware/Marlin/issues/new?title=&body='+text).replace(/\#/g,'%23'))
      })
    })
    var state=$('.mct-header input')
    .on('change',function(){
      if ($(this).prop('checked'))
        $('.form-group').not('.bg-info').hide()
      else
        $('.form-group').show();
//      console.log(arguments)
    })

})