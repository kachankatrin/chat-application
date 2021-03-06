<template>
  <div class="VuetifyApp">
    <v-app v-if="!ap" id="miniChatDrawer" class="miniChatDrawer">
      <a :class="statusClass" class="dropdown-toggle">
        <v-icon class="my-auto uiIconStatus uiNotifChatIcon" @click="openDrawer"></v-icon>
        <span :class="canShowOnSiteNotif() && totalUnreadMsg > 0 ? '' : 'hidden'" class="notif-total badgeDefault badgePrimary mini">{{ totalUnreadMsg }}</span>
      </a>
      <exo-drawer ref="chatDrawer"
                  class="chatDrawer"
                  body-classes="hide-scroll"
                  right
                  @closed="resetSelectedContact">
        <template v-if="!showSearch" slot="title">
          <div class="leftHeaderDrawer">
            <span v-if="!selectedContact && !showSearch" class="chatContactDrawer">
              <exo-chat-contact :chat-drawer-contact="showChatDrawer" :user-name="userSettings.username" :status="userSettings.status" :is-current-user="true" type="u" @status-changed="setStatus($event)"></exo-chat-contact>
            </span>
            <v-icon v-show="selectedContact" class="my-auto backButton" @click="backChat()">mdi-keyboard-backspace</v-icon>
            <span v-if="selectedContact" >
              <img :src="contactAvatar" class="chatAvatar" alt="avatar of discussion"/>
              <span :class="statusStyle" class="user-status">
                <i v-if="selectedContact.type=='u' && (selectedContact.isEnabledUser || selectedContact.isEnabledUser === null)" class="uiIconStatus"></i>
                <span :title="getName">{{ getName }}</span>
              </span>
            </span>
          </div>
        </template>
        <template v-if="showChatDrawer && !selectedContact" slot="title">
          <input v-show="showSearch" v-model="searchTerm" :placeholder="$t('exoplatform.chat.contact.search.placeholder')" class="searchDrawer" type="text">
        </template>
        <template slot="titleIcons">
          <div v-show="selectedContact && (selectedContact.isEnabledUser || selectedContact.isEnabledUser === null)"
               class="title-action-component">
            <div v-for="action in titleActionComponents" v-if="action.enabled" :key="action.key"
                 :class="`${action.appClass}Action`">
              <div v-if="action.component">
                <component v-dynamic-events="action.component.events"
                           v-bind="action.component.props ? action.component.props : {}"
                           :is="action.component.name" :ref="action.key"></component>
              </div>
              <div v-else-if="action.element" v-html="action.element.outerHTML">
              </div>
              <div v-else-if="action.html" v-html="action.html">
              </div>
            </div>
          </div>
          <v-icon v-show = "showSearch && !selectedContact" class="my-auto" @click="closeContactSearch">mdi-filter-remove</v-icon>
          <v-icon v-show = "!showSearch && !selectedContact" class="my-auto" @click="openContactSearch">mdi-filter</v-icon>
          <v-icon v-show="selectedContact && selectedContact.type=='u' && (selectedContact.isEnabledUser || selectedContact.isEnabledUser === null)" class="my-auto">mdi-video</v-icon>
          <v-icon v-show="mq !=='mobile' && !showSearch" :title="$t('exoplatform.chat.open.chat')" class="my-auto" @click="navigateTo">mdi-open-in-new</v-icon>
        </template>
        <template slot="content">
          <div :class="!selectedContact ? 'contentDrawer ' : 'contentDrawerOfList'">
            <exo-chat-contact-list v-show="!selectedContact && contactList.length > 0" :search-word="searchTerm" :drawer-status="showChatDrawer" :contacts="contactList" :selected="selectedContact" :loading-contacts="loadingContacts" @load-more-contacts="loadMoreContacts" @contact-selected="setSelectedContact" @refresh-contacts="refreshContacts($event)"></exo-chat-contact-list>
            <exo-chat-message-list v-show="selectedContact" :contact="selectedContact" :user-settings="userSettings" :is-opened-contact="!selectedContact"></exo-chat-message-list>
          </div>
        </template>
      </exo-drawer>
    </v-app>
    <div class="hide">
      <audio id="chat-audio-notif" controls>
        <source src="/chat/audio/notif.wav">
        <source src="/chat/audio/notif.mp3">
        <source src="/chat/audio/notif.ogg">
      </audio>
    </div>
  </div>
</template>

<script>
import * as chatServices from '../../chatServices';
import {installExtensions} from '../../extension';
import {chatConstants} from '../../chatConstants';
import * as chatWebSocket from '../../chatWebSocket';
import {getUserAvatar} from '../../chatServices';
import {getSpaceAvatar} from '../../chatServices';
import * as desktopNotification from '../../desktopNotification';
import {getMiniChatTitleActionComponents} from '../../extension';
export default {
  name: 'ExoChatDrawer',
  data () {
    return {
      contactList: [],
      showSearch:false,
      loadingContacts: true,
      selectedContact: [],
      userSettings: {
        username: typeof eXo !== 'undefined' ? eXo.env.portal.userName : ''
      },
      showChatDrawer:false,
      fullNameOfUser:'',
      isOnline : true,
      searchTerm:'',
      totalUnreadMsg:0,
      titleActionComponents: ''
    };
  },
  computed:{
    statusClass() {
      if (this.userSettings.status === 'invisible') {
        return 'user-offline';
      } else {
        return `user-${this.userSettings.status}`;
      }
    },
    contactAvatar() {
      if(this.selectedContact){
        if (this.selectedContact.type === 'u') {
          return getUserAvatar(this.selectedContact.user);
        } else if (this.selectedContact.type === 's') {
          return getSpaceAvatar(this.selectedContact.prettyName);
        } else {
          return chatConstants.DEFAULT_ROOM_AVATAR;
        }
      }
    },
    statusStyle: function() {
      if (!this.selectedContact) {
        if (!this.isOnline || this.userSettings.status === 'invisible') {
          return 'user-offline';
        } else {
          return `user-${this.userSettings.status}`;
        }
      } else if(typeof this.selectedContact !== 'undefined'){
        if (!this.isOnline||  this.selectedContact.status === 'invisible') {
          return 'user-offline';
        } else {
          return `user-${this.selectedContact.status}`;
        }
      }
    },
    getName(){
      if (!this.selectedContact) {
        return this.userSettings.username;
      } else {
        return this.selectedContact.fullName;
      }
    }
  },
  created() {
    chatServices.initChatSettings(this.userSettings.username, false,
      userSettings => this.initSettings(userSettings),
      chatRoomsData => {
        this.initChatRooms(chatRoomsData);
        const totalUnreadMsg = Math.abs(Number(chatRoomsData.unreadOffline) + Number(chatRoomsData.unreadSpaces)+Number(chatRoomsData.unreadOnline) + Number(chatRoomsData.unreadTeams));
        if(totalUnreadMsg >= 0) {
          this.totalUnreadMsg = totalUnreadMsg;
        }
      });
    document.addEventListener(chatConstants.EVENT_ROOM_UPDATED, this.roomUpdated);
    document.addEventListener(chatConstants.EVENT_LOGGED_OUT, this.userLoggedout);
    document.addEventListener(chatConstants.EVENT_DISCONNECTED, this.changeUserStatusToOffline);
    document.addEventListener(chatConstants.EVENT_CONNECTED, this.connectionEstablished);
    document.addEventListener(chatConstants.EVENT_RECONNECTED, this.connectionEstablished);
    document.addEventListener(chatConstants.EVENT_USER_STATUS_CHANGED, this.userStatusChanged);
    document.addEventListener(chatConstants.EVENT_GLOBAL_UNREAD_COUNT_UPDATED, this.totalUnreadMessagesUpdated);
    document.addEventListener(chatConstants.ACTION_ROOM_OPEN_CHAT, this.openRoom);
    this.refreshTitleActionComponents();

    // To refresh mini chat title action components when a new action component is ready to be used
    document.addEventListener('mini-chat-title-action-components-updated', this.refreshTitleActionComponents);
  },
  destroyed() {
    document.removeEventListener(chatConstants.EVENT_ROOM_UPDATED, this.roomUpdated);
    document.removeEventListener(chatConstants.EVENT_LOGGED_OUT, this.userLoggedout);
    document.removeEventListener(chatConstants.EVENT_DISCONNECTED, this.changeUserStatusToOffline);
    document.removeEventListener(chatConstants.EVENT_CONNECTED, this.connectionEstablished);
    document.removeEventListener(chatConstants.EVENT_RECONNECTED, this.connectionEstablished);
    document.removeEventListener(chatConstants.EVENT_USER_STATUS_CHANGED, this.userStatusChanged);
    document.removeEventListener(chatConstants.EVENT_GLOBAL_UNREAD_COUNT_UPDATED, this.totalUnreadMessagesUpdated);
    document.removeEventListener(chatConstants.ACTION_ROOM_OPEN_CHAT, this.openRoom);
  },
  methods:{
    openDrawer() {
      this.$refs.chatDrawer.open();
      this.showChatDrawer = true;
      this.selectedContact = null;
    },
    navigateTo() {
      window.open('/portal/'.concat(eXo.env.portal.portalName).concat('/chat'),'_blank');
    },
    resetSelectedContact() {
      this.showChatDrawer = false;
      this.showSearch = false;
      this.selectedContact = null;
    },
    setStatus(status) {
      chatServices.setUserStatus(this.userSettings, status, newStatus => {
        this.userSettings.status = newStatus;
        this.userSettings.originalStatus = newStatus;
      });
    },
    userLoggedout() {
      if (!chatWebSocket.isConnected()) {
        this.changeUserStatusToOffline();
      }
    },
    totalUnreadMessagesUpdated(e) {
      const totalUnreadMsg = e.detail ? e.detail.data.totalUnreadMsg : e.totalUnreadMsg;
      if(totalUnreadMsg >= 0) {
        this.totalUnreadMsg = totalUnreadMsg;
      }
    },
    userStatusChanged(e) {
      const contactChanged = e.detail;
      if (this.userSettings.username === contactChanged.sender) {
        this.userSettings.status = contactChanged.status ? contactChanged.status : contactChanged.data ? contactChanged.data.status : null;
        this.userSettings.originalStatus = this.userSettings.status;
      }
    },
    connectionEstablished() {
      eXo.chat.isOnline = true;
      if (this.userSettings.originalStatus !== this.userSettings.status) {
        this.setStatus(this.userSettings.originalStatus);
      } else if (this.userSettings && this.userSettings.originalStatus) {
        this.userSettings.status = this.userSettings.originalStatus;
      }
    },
    roomUpdated(e) {
      const updatedContact = e.detail && e.detail.data ? e.detail.data : null;
      if (updatedContact && (updatedContact.room || updatedContact.user)) {
        const indexOfRoom = this.contactList.findIndex(contact => contact.room === updatedContact.room || contact.user === updatedContact.user);
        if(indexOfRoom < 0) {
          this.contactList.unshift(updatedContact);
        } else {
          this.contactList.splice(indexOfRoom, 1, updatedContact);
        }
      }
    },
    addRooms(rooms) {
      this.contactList = [];
      const contacts = this.contactList.slice(0);
      rooms = rooms.filter(contact => contact.fullName
              && contact.fullName.trim().length > 0
              && (contact.room && contact.room.trim().length > 0 || contact.user && contact.user.trim().length > 0)
              && !contacts.find(otherContact => otherContact.room === contact.room || otherContact.user === contact.user));
      if(rooms && rooms.length > 0) {
        rooms.forEach(room => {
          this.contactList.push(room);
        });
      }
    },
    initSettings(userSettings) {
      this.userSettings = userSettings;
      // Trigger that the new status has been loaded
      this.setStatus(this.userSettings.status);
      installExtensions(this.userSettings);
      const thiss = this;
      if(this.userSettings.offlineDelay) {
        setInterval(
          function() {thiss.refreshContacts(true);},
          this.userSettings.offlineDelay);
      }
    },
    initChatRooms(chatRoomsData) {
      this.loadingContacts = false;
      this.addRooms(chatRoomsData.rooms);
      const totalUnreadMsg = Math.abs(chatRoomsData.unreadOffline) + Math.abs(chatRoomsData.unreadOnline) + Math.abs(chatRoomsData.unreadSpaces) + Math.abs(chatRoomsData.unreadTeams);
      chatServices.updateTotalUnread(totalUnreadMsg);
    },
    loadMoreContacts(nbPages) {
      this.loadingContacts = true;
      chatServices.getOnlineUsers().then(users => {
        chatServices.getChatRooms(this.userSettings, users, '', nbPages).then(chatRoomsData => {
          this.addRooms(chatRoomsData.rooms);
          this.loadingContacts = false;
        });
      });
    },
    setSelectedContact(selectedContact) {
      if(!selectedContact && selectedContact.length() === 0) {
        selectedContact = {};
      }
      if (typeof selectedContact === 'string') {
        selectedContact = this.contactList.find(contact => contact.room === selectedContact || contact.user === selectedContact);
      }
      if (selectedContact && selectedContact.fullName && (selectedContact.room || selectedContact.user)) {
        eXo.chat.selectedContact = selectedContact;
        const indexOfRoom = this.contactList.findIndex(contact => contact.room === selectedContact.room || contact.user === selectedContact.user);
        if(indexOfRoom < 0) {
          this.contactList.unshift(selectedContact);
        } else {
          this.contactList.splice(indexOfRoom, 1, selectedContact);
        }
      }
      this.selectedContact = selectedContact;
      chatServices.getRoomParticipants(eXo.chat.userSettings, selectedContact).then( data => {
        this.selectedContact.participants = data.users;
        document.dispatchEvent(new CustomEvent(chatConstants.EVENT_ROOM_SELECTION_CHANGED, {'detail' : this.selectedContact}));
      });
      this.showSearch = false;
    },
    refreshContacts(keepSelectedContact) {
      chatServices.getOnlineUsers().then(users => {
        chatServices.getChatRooms(this.userSettings, users).then(chatRoomsData => {
          this.addRooms(chatRoomsData.rooms);
          if (!keepSelectedContact && this.selectedContact) {
            const contactToChange = this.contactList.find(contact => contact.room === this.selectedContact.room || contact.user === this.selectedContact.user || contact.room === this.selectedContact);
            if(contactToChange) {
              this.setSelectedContact(contactToChange);
            }
          }
        });
      });
    },
    searchContacts(term) {
      this.loadingContacts = true;
      chatServices.getOnlineUsers().then(users => {
        chatServices.getChatRooms(this.userSettings, users, term).then(chatRoomsData => {
          this.addRooms(chatRoomsData.rooms);
          this.loadingContacts = false;
        });
      });
    },
    changeUserStatusToOffline() {
      if (this.userSettings && this.userSettings.status && !this.userSettings.originalStatus) {
        this.userSettings.originalStatus = this.userSettings.status;
      }
      eXo.chat.isOnline = false;
    },
    reloadPage() {
      window.location.reload();
    },
    openRoom(e) {
      const roomName = e.detail ? e.detail.name : null;
      const roomType = e.detail ? e.detail.type : null;
      if(roomName && roomName.trim().length) {
        chatServices.getRoomId(this.userSettings, roomName, roomType).then(rommId => {
          const selectedContact = this.contactList.find(contact => contact.room === rommId || contact.user === rommId);
          if ( !selectedContact ) {
            this.refreshContacts(false);
            this.selectedContact = rommId;
          } else {
            this.setSelectedContact(rommId);
          }
          if (this.$refs.chatDrawer) {
            this.$refs.chatDrawer.open();
          }
        });
      }
      const tiptip = document.getElementById('tiptip_holder');
      if (tiptip) {
        tiptip.style.display = 'none';
      }
    },
    openContactSearch() {
      this.showSearch = true;
    },
    closeContactSearch() {
      this.showSearch = false;
      this.searchTerm = '';
    },
    selectContactSearch() {
      this.showSearch = false;
      this.$nextTick(() => this.$refs.contactSearch.focus());
    },
    canShowOnSiteNotif() {
      return desktopNotification.canShowOnSiteNotif();
    },
    backChat(){
      this.selectedContact = null;
    },
    refreshTitleActionComponents() {
      this.titleActionComponents = getMiniChatTitleActionComponents();
      // TO DO Fix init (mini chat creates earlier than chat and we don't have correct eXo.chat)
      //this.initTitleActionComponents();
    },
    initTitleActionComponents() {
      for (const action of this.titleActionComponents) {
        if (action.init) {
          action.init(eXo.chat);
        }
      }
    }
  }
};
</script>



