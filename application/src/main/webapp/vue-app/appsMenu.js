export const MAX_FILES = 1;
export const UPLOAD_URI = '/portal/upload';

export const DEFAULT_COMPOSER_APPS = [
  {
    key: 'event',
    type: 'type-event',
    labelKey: 'exoplatform.chat.add.event',
    iconClass: 'uiIconChatCreateEvent',
    appClass: 'chat-app-event',
    html(i18NConverter) {
      const NUMBER_HALF_HOUR_PER_DAY = 48;
      const NUMBERS_MAX_WITH_ONE_DIGIT = 10;
      const PAIR = 2;
      let timeOptions = '';
      for (let i = 0; i < NUMBER_HALF_HOUR_PER_DAY; i++) {
        let hours = Math.floor(i / PAIR);
        hours = hours < NUMBERS_MAX_WITH_ONE_DIGIT ? `0${hours}` : hours;
        const minutes = i % PAIR === 0 ? '00' : '30';
        timeOptions += `<option value="${hours}:${minutes}">${hours}:${minutes}</option>`;
      }
      return `<input name="summary" placeholder="${i18NConverter('exoplatform.chat.event.title')}" class="large" type="text" required> \
        <div class="chat-event-date form-horizontal"> \
          <div class="event-item"> \
            <span class="action-label">${i18NConverter('exoplatform.chat.from')}</span> \
            <input name="startDate" format="MM/dd/yyyy" placeholder="mm/dd/yyyy" type="text" required onfocus="require(['SHARED/CalDateTimePicker'], (CalDateTimePicker) => CalDateTimePicker.init(event.target, false));"> \
            <select name="startTime" class="selectbox" required> \
              <option value="all-day">${i18NConverter('exoplatform.chat.all.day')}</option>
              ${timeOptions}
            </select> \
          </div> \
          <div class="event-item"> \
            <span class="action-label">${i18NConverter('exoplatform.chat.to')}</span> \
            <input name="endDate" format="MM/dd/yyyy" placeholder="mm/dd/yyyy" type="text" required onfocus="require(['SHARED/CalDateTimePicker'], (CalDateTimePicker) => CalDateTimePicker.init(event.target, false));"> \
            <select name="endTime" class="selectbox" required> \
              <option value="all-day">${i18NConverter('exoplatform.chat.all.day')}</option>
              ${timeOptions}
            </select> \
          </div> \
        </div> \
        <input name="location" class="large" type="text" placeholder="Location" required> `;
    },
    submit(chatServices, message, formData, contact) {
      if (formData.startTime === 'all-day') {
        formData.startTime = '00:00';
        formData.startAllDay = true;
      }

      if (formData.endTime === 'all-day') {
        formData.endTime = '23:59';
        formData.endAllDay = true;
      }

      return chatServices.saveEvent(eXo.chat.userSettings, formData, contact).then((response)=> {
        if(!response.ok) {
          return {errorCode : 'ErrorSaveEvent'};
        }
        return {ok : true};
      }).catch(() => {
        return {errorCode : 'ErrorSaveEvent'};
      });
    }
  },
  {
    key: 'link',
    type: 'type-link',
    labelKey: 'exoplatform.chat.share.link',
    iconClass: 'uiIconChatLink',
    html() {
      return '<input id="link" name="link" class="large" type="text" placeholder="E.g: http://www.exoplatform.com" required>';
    },
    checkURL(text) {
      // if user has not entered http:// https:// or ftp:// assume they mean http://
      if (!/^(https?|ftp):\/\//i.test(text)) {
        text = `http://${text}`; // set both the value
      }
      return text;
    },
    submit(chatServices, message, formData) {
      message.options.link = this.checkURL(formData['link']);
      return {ok: true};
    }
  },
  {
    key: 'file',
    type: 'type-file',
    labelKey: 'exoplatform.chat.upload.file',
    iconClass: 'uiIconChatUpload',
    hideModalActions: true,
    contact: null,
    i18NConverter: null,
    appClass: 'chat-file-upload DropZone',
    init(contact) {
      this.contact = contact;
    },
    html(i18NConverter) {
      this.i18NConverter = i18NConverter;
      return `<div class="progressBar"> \
                <div class="progress"> \
                  <div class="bar" style="width: 0.0%;"></div> \
                  <div class="label"> \
                    <div class="label-inner">${i18NConverter('exoplatform.chat.file.drop')}</div> \
                  </div> \
                </div> \
              </div> \
              <div class="uiActionBorder"> \
                <a href="#" class="btn btn-primary chat-file-upload" type="button"> \
                  <span>${i18NConverter('exoplatform.chat.file.manually')}</span> \
                  <input id="chat-file-file" type="file" name="userfile" /> \
                </a> \
                <input id="chat-file-submit" value="${i18NConverter('exoplatform.chat.file.manually')}" type="submit" style="display:none" /> \
                <a href="#" type="button" class="btn btnClosePopup" onclick="document.dispatchEvent(new CustomEvent('exo-chat-apps-close'))">${i18NConverter('exoplatform.chat.cancel')}</a> \
              </div>`;
    },
    htmlAdded($) {
      this.initUpload($);
    },
    showButtons($, show) {
      if(show) {
        $('.apps-composer-modal .chat-file-upload .uiActionBorder').show();
      } else {
        $('.apps-composer-modal .chat-file-upload .uiActionBorder').hide();
      }
    },
    setErrorCode($, error, errorOpts) {
      const $alertContainer = $('.apps-composer-modal .alert-error');
      if(error && error.length) {
        $alertContainer.html(this.i18NConverter(`exoplatform.chat.${error}`, errorOpts));
        $alertContainer.show();
      } else {
        $alertContainer.hide();
        $alertContainer.html('');
      }
    },
    initUpload($) {
      const MAX_RANDOM_NUMBER = 100000;
      const uploadId = Math.round(Math.random() * MAX_RANDOM_NUMBER);
      const $dropzoneContainer = $('#appComposerForm .DropZone');
      const thiss = this;

      $dropzoneContainer.filedrop({
        fallback_id: 'chat-file-file',  // an identifier of a standard file input element
        url: `${UPLOAD_URI}?uploadId=${uploadId}&action=upload`,  // upload handler, handles each file separately, can also be a function taking the file and returning a url
        paramname: 'userfile',          // POST parameter name used on serverside to reference file
        error: function (err) {
          switch (err) {
          case 'ErrorBrowserNotSupported':
          case 'BrowserNotSupported':
            thiss.setErrorCode($, 'BrowserNotSupported');
            break;
          case 'ErrorTooManyFiles':
          case 'TooManyFiles':
            thiss.setErrorCode($, 'TooManyFiles');
            break;
          case 'ErrorFileTooLarge':
          case 'FileTooLarge':
            thiss.setErrorCode($, 'upload.filesize', {0: eXo.chat.userSettings.maxUploadSize});
            break;
          case 'ErrorFileTypeNotAllowed':
          case 'FileTypeNotAllowed':
            thiss.setErrorCode($, 'FileTypeNotAllowed');
            break;
          }
          thiss.showButtons($, true);
        },
        allowedfiletypes: [],   // filetypes allowed by Content-Type.  Empty array means no restrictions
        maxfiles: MAX_FILES,
        maxfilesize: eXo.chat.userSettings.maxUploadSize,    // max file size in MBs
        uploadStarted: function() {
          thiss.setErrorCode($, '');
          thiss.showButtons($, false);
        },
        progressUpdated: function (i, file, progress) {
          $dropzoneContainer.find('.bar').width(`${progress}%`);
          $dropzoneContainer.find('.bar').html(`${progress}%`);
        },
        uploadFinished: function () {
          fetch(UPLOAD_URI, {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
            },
            method: 'post',
            credentials: 'include',
            body: $.param({
              uploadId: uploadId,
              action: 'progress'
            })
          }).then(resp =>  resp.text()).then(data => {
            data = data.replace(' upload :', ' "upload" :');
            data = JSON.parse(data);
            const UPLOAD_PERCENT_COMPLETE = 100;
            data = data && data.upload && data.upload[uploadId] ? data.upload[uploadId] : null;
            if (!data || !data.percent || data.percent !== UPLOAD_PERCENT_COMPLETE && data.percent !== '100') {
              thiss.setErrorCode($, 'ErrorFileUploadNotComplete');
              return;
            }
            fetch('/portal/rest/chat/api/1.0/file/persist',{
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
              },
              method: 'post',
              credentials: 'include',
              body: $.param({
                uploadId: uploadId,
                dbName: eXo.chat.userSettings.dbName,
                token: eXo.chat.userSettings.token,
                targetRoom: thiss.contact.user,
                targetFullname: thiss.contact.fullName
              })
            }).then(resp =>  {
              if(!resp.ok) {
                thiss.setErrorCode($, 'ErrorPersistFile');
                return;
              } else {
                return resp.json();
              }
            }).then(options => {
              if(!options) {
                thiss.setErrorCode($, 'UknownError');
                return;
              }
              options.type = 'type-file';
              const message = {
                msg: options.name,
                isSystem: true,
                room : thiss.contact.room,
                clientId: new Date().getTime().toString(),
                user: eXo.chat.userSettings.username,
                options : options
              };
              document.dispatchEvent(new CustomEvent('exo-chat-message-tosend', {'detail' : message}));
              document.dispatchEvent(new CustomEvent('exo-chat-apps-close'));
            });
          });
        }
      });
    }
  },
  {
    key: 'question',
    type: 'type-question',
    labelKey: 'exoplatform.chat.ask.question',
    iconClass: 'uiIconChatQuestion',
    html(i18NConverter) {
      return `<input name="msg" placeholder="${i18NConverter('exoplatform.chat.question.what')}" class="large" type="text" required>`;
    },
    submit(chatServices, message, formData) {
      message.msg = formData['msg'];
      return {ok: true};
    }
  },
  {
    key: 'raise-hand',
    type: 'type-hand',
    labelKey: 'exoplatform.chat.raise.hand',
    iconClass: 'uiIconChatRaiseHand',
    html(i18NConverter) {
      return `<input name="msg" placeholder="${i18NConverter('exoplatform.chat.optional.comment')}" class="large" type="text">`;
    },
    submit(chatServices, message, formData) {
      message.msg = formData['msg'];
      return {ok: true};
    }
  }
];
