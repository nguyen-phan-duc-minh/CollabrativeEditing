import React, { useState, useRef, useEffect } from 'react';
import { Button, Modal, Alert } from 'react-bootstrap';
import { FaVideo, FaVideoSlash, FaMicrophone, FaMicrophoneSlash, FaPhoneSlash } from 'react-icons/fa';
import websocketService from '../services/websocket';
import './VideoCall.css';

interface VideoCallProps {
  show: boolean;
  onHide: () => void;
  documentId: string;
  currentUserId: number;
  userName: string;
}

interface Participant {
  id: number;
  name: string;
  stream?: MediaStream;
}

export default function VideoCall({ show, onHide, documentId, currentUserId, userName }: VideoCallProps) {
  const [isInCall, setIsInCall] = useState(false);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [error, setError] = useState<string>('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [isCallActive, setIsCallActive] = useState(false); // Track if call is active globally
  const [callCreator, setCallCreator] = useState<string>(''); // Track who created the call

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideosRef = useRef<{ [key: number]: HTMLVideoElement }>({});

  // Initialize media stream
  const initializeMedia = async () => {
    try {
      setError('');
      setIsConnecting(true);

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user'
        },
        audio: true
      });

      setLocalStream(stream);
      
      // Wait for video element to be ready
      setTimeout(() => {
        if (localVideoRef.current && stream) {
          localVideoRef.current.srcObject = stream;
          localVideoRef.current.play().catch(console.error);
        }
      }, 100);

      return stream;
    } catch (err) {
      console.error('Error accessing media devices:', err);
      setError('Failed to access camera/microphone. Please check permissions.');
      return null;
    } finally {
      setIsConnecting(false);
    }
  };

  // Start video call
  const startCall = async () => {
    const stream = await initializeMedia();
    if (!stream) return;

    setIsInCall(true);
    setIsCallActive(true);
    setCallCreator(userName);
    
    // Notify other users about the call
    websocketService.emitVideoCallEvent('video_call.start', {
      document_id: documentId,
      user_id: currentUserId,
      user_name: userName
    });

    // Add self as participant
    setParticipants([{
      id: currentUserId,
      name: userName,
      stream
    }]);
  };

  // Join existing call
  const joinCall = async () => {
    const stream = await initializeMedia();
    if (!stream) return;

    setIsInCall(true);
    
    // Notify about joining
    websocketService.emitVideoCallEvent('video_call.join', {
      document_id: documentId,
      user_id: currentUserId,
      user_name: userName
    });
  };

  // End call
  const endCall = () => {
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
    }

    setIsInCall(false);
    
    // If this user created the call and is ending it, end for everyone
    if (callCreator === userName) {
      setIsCallActive(false);
      setCallCreator('');
      setParticipants([]);
    } else {
      // Just remove this user from participants
      setParticipants(prev => prev.filter(p => p.id !== currentUserId));
    }
    
    websocketService.emitVideoCallEvent('video_call.end', {
      document_id: documentId,
      user_id: currentUserId,
      user_name: userName,
      is_creator: callCreator === userName
    });
  };

  // Toggle video
  const toggleVideo = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoEnabled(videoTrack.enabled);
      }
    }
  };

  // Toggle audio
  const toggleAudio = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioEnabled(audioTrack.enabled);
      }
    }
  };

  // WebSocket event handlers
  useEffect(() => {
    if (!show) return;

    const handleCallStart = (data: any) => {
      console.log('🎥 Received video_call.started:', data);
      if (data.document_id === documentId && data.user_id !== currentUserId) {
        setIsCallActive(true);
        setCallCreator(data.user_name);
        setParticipants(prev => {
          const exists = prev.find(p => p.id === data.user_id);
          if (exists) return prev;
          return [...prev, {
            id: data.user_id,
            name: data.user_name
          }];
        });
        console.log('🎥 Call started by:', data.user_name, 'isCallActive:', true);
      }
    };

    const handleCallJoin = (data: any) => {
      console.log('🎥 Received video_call.joined:', data);
      if (data.document_id === documentId && data.user_id !== currentUserId) {
        setParticipants(prev => {
          const exists = prev.find(p => p.id === data.user_id);
          if (exists) return prev;
          return [...prev, {
            id: data.user_id,
            name: data.user_name
          }];
        });
      }
    };

    const handleCallEnd = (data: any) => {
      console.log('🎥 Received video_call.ended:', data);
      if (data.document_id === documentId) {
        if (data.is_creator) {
          // Call creator ended the call - end for everyone
          setIsCallActive(false);
          setCallCreator('');
          setParticipants([]);
          if (isInCall) {
            // End local call as well
            if (localStream) {
              localStream.getTracks().forEach(track => track.stop());
              setLocalStream(null);
            }
            setIsInCall(false);
          }
          console.log('🎥 Call ended by creator');
        } else {
          // Just remove the user who left
          setParticipants(prev => prev.filter(p => p.id !== data.user_id));
          console.log('🎥 User left call:', data.user_name);
        }
      }
    };

    // Check for existing call when component opens
    const handleCallStatus = (data: any) => {
      console.log('🎥 Received video_call.status:', data);
      if (data.document_id === documentId) {
        setIsCallActive(data.is_active);
        setCallCreator(data.creator || '');
        setParticipants(data.participants || []);
        console.log('🎥 Call status updated:', {
          isActive: data.is_active,
          creator: data.creator,
          participants: data.participants?.length || 0
        });
      }
    };

    websocketService.on('video_call.started', handleCallStart);
    websocketService.on('video_call.joined', handleCallJoin);
    websocketService.on('video_call.ended', handleCallEnd);
    websocketService.on('video_call.status', handleCallStatus);

    // Request current call status when component opens
    console.log('🎥 Requesting call status for document:', documentId);
    websocketService.emitVideoCallEvent('video_call.get_status', {
      document_id: documentId
    });

    return () => {
      websocketService.off('video_call.started', handleCallStart);
      websocketService.off('video_call.joined', handleCallJoin);
      websocketService.off('video_call.ended', handleCallEnd);
      websocketService.off('video_call.status', handleCallStatus);
    };
  }, [show, documentId, currentUserId, isInCall, localStream]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [localStream]);

  // Update video element when stream changes
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
      localVideoRef.current.play().catch(console.error);
    }
  }, [localStream]);

  const handleClose = () => {
    if (isInCall) {
      endCall();
    }
    onHide();
  };

  return (
    <Modal show={show} onHide={handleClose} size="lg" centered>
      <Modal.Header closeButton>
        <Modal.Title>
          <FaVideo className="me-2" />
          Video Call
        </Modal.Title>
      </Modal.Header>

      <Modal.Body>
        {error && (
          <Alert variant="danger" className="mb-3">
            {error}
          </Alert>
        )}

        {isConnecting && (
          <div className="text-center py-4">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Connecting...</span>
            </div>
            <p className="mt-2">Accessing camera and microphone...</p>
          </div>
        )}

        {!isInCall && !isConnecting && (
          <div className="text-center py-4">
            {/* Debug info - remove in production */}
            <div className="mb-2" style={{ fontSize: '12px', color: '#666' }}>
              Debug: isCallActive={isCallActive ? 'true' : 'false'}, 
              creator="{callCreator}", 
              participants={participants.length},
              currentUser={currentUserId}
            </div>
            
            <div className="video-call-preview mb-4">
              <FaVideo size={48} className="text-muted" />
              <h5 className="mt-3">
                {isCallActive ? 'Join the video call?' : 'Ready to start video call?'}
              </h5>
              <p className="text-muted">
                {isCallActive 
                  ? `${callCreator} started a call with ${participants.length} participant(s)`
                  : 'No active call in this document'
                }
              </p>
              {participants.length > 0 && (
                <div className="mt-2">
                  <small className="text-muted">
                    Participants: {participants.map(p => p.name).join(', ')}
                  </small>
                </div>
              )}
            </div>
            
            <div className="d-flex gap-2 justify-content-center">
              {!isCallActive ? (
                <Button 
                  variant="success" 
                  onClick={startCall}
                  disabled={isConnecting}
                >
                  <FaVideo className="me-2" />
                  Tạo video call
                </Button>
              ) : (
                <Button 
                  variant="primary" 
                  onClick={joinCall}
                  disabled={isConnecting}
                >
                  <FaVideo className="me-2" />
                  Tham gia video call
                </Button>
              )}
            </div>
          </div>
        )}

        {isInCall && (
          <div className="video-call-container">
            {/* Local Video */}
            <div className="video-grid">
              <div className="video-participant">
                <video
                  ref={localVideoRef}
                  autoPlay
                  muted
                  playsInline
                  className="video-element"
                />
                <div className="participant-name">You ({userName})</div>
              </div>

              {/* Remote Videos */}
              {participants.filter(p => p.id !== currentUserId).map(participant => (
                <div key={participant.id} className="video-participant">
                  <div className="video-placeholder">
                    <FaVideo size={32} className="text-muted" />
                    <div className="participant-name">{participant.name}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Call Controls */}
            <div className="call-controls mt-3 d-flex justify-content-center gap-2">
              <Button
                variant={isVideoEnabled ? "outline-primary" : "outline-secondary"}
                onClick={toggleVideo}
                className="control-btn"
              >
                {isVideoEnabled ? <FaVideo /> : <FaVideoSlash />}
              </Button>
              
              <Button
                variant={isAudioEnabled ? "outline-primary" : "outline-secondary"}
                onClick={toggleAudio}
                className="control-btn"
              >
                {isAudioEnabled ? <FaMicrophone /> : <FaMicrophoneSlash />}
              </Button>
              
              <Button
                variant="danger"
                onClick={endCall}
                className="control-btn"
              >
                <FaPhoneSlash />
              </Button>
            </div>
          </div>
        )}
      </Modal.Body>
    </Modal>
  );
}